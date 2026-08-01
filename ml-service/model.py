"""Гистограммалық градиенттік бустинг (регрессия, квадраттық шығын).

Тек numpy-ға тәуелді — сыртқы ML кітапханасы жоқ. Себебі:
  1) шығарылатын модель форматын толық бақылаймыз (TypeScript-те қайта оқылады);
  2) GitHub Actions-та орнату жеңіл әрі тұрақты.

Оқытылған модель JSON ағаштар жиынтығы ретінде экспортталады; болжамды
`src/lib/ml/gbt.ts` дәл сол логикамен есептейді.
"""

from __future__ import annotations

import numpy as np


class Tree:
    __slots__ = ("feature", "threshold", "left", "right", "value")

    def __init__(self) -> None:
        self.feature: list[int] = []
        self.threshold: list[float] = []
        self.left: list[int] = []
        self.right: list[int] = []
        self.value: list[float] = []

    def add_node(self) -> int:
        self.feature.append(-1)
        self.threshold.append(0.0)
        self.left.append(-1)
        self.right.append(-1)
        self.value.append(0.0)
        return len(self.feature) - 1

    def to_dict(self) -> dict:
        return {
            "f": self.feature,
            "t": [round(float(v), 5) for v in self.threshold],
            "l": self.left,
            "r": self.right,
            "v": [round(float(v), 6) for v in self.value],
        }


def _bin_edges(x: np.ndarray, n_bins: int) -> np.ndarray:
    """Квантильдік шекаралар (ішкі шекаралар ғана, ұзындығы ≤ n_bins−1)."""
    qs = np.linspace(0.0, 1.0, n_bins + 1)[1:-1]
    edges = np.unique(np.quantile(x, qs))
    return edges.astype(np.float64)


def _apply(tree: Tree, X: np.ndarray) -> np.ndarray:
    """Шикі (қорапталмаған) X бойынша ағаштың жапырақ мәндерін қайтарады.
    TypeScript нұсқасымен дәл сол жол — `x <= threshold` → сол жақ."""
    out = np.zeros(X.shape[0], dtype=np.float64)
    stack = [(0, np.arange(X.shape[0], dtype=np.int32))]
    while stack:
        node, idx = stack.pop()
        if idx.size == 0:
            continue
        if tree.feature[node] < 0:
            out[idx] = tree.value[node]
            continue
        mask = X[idx, tree.feature[node]] <= tree.threshold[node]
        stack.append((tree.left[node], idx[mask]))
        stack.append((tree.right[node], idx[~mask]))
    return out


class GradientBoosting:
    def __init__(
        self,
        n_trees: int = 600,
        learning_rate: float = 0.05,
        max_depth: int = 5,
        min_samples_leaf: int = 60,
        n_bins: int = 64,
        min_gain: float = 1e-6,
        l2: float = 20.0,
        patience: int = 40,
    ) -> None:
        self.n_trees = n_trees
        self.lr = learning_rate
        self.max_depth = max_depth
        self.min_samples_leaf = min_samples_leaf
        self.n_bins = n_bins
        self.min_gain = min_gain
        self.l2 = l2  # жапырақ мәнін тежейтін регуляризация
        self.patience = patience
        self.base = 0.0
        self.trees: list[Tree] = []
        self.edges: list[np.ndarray] = []
        self.stopped_at: int | None = None

    # --- оқыту ------------------------------------------------------------
    def fit(
        self,
        X: np.ndarray,
        y: np.ndarray,
        X_val: np.ndarray | None = None,
        y_val: np.ndarray | None = None,
        verbose: bool = True,
    ) -> "GradientBoosting":
        """Ерте тоқтатумен оқыту.

        `X_val`/`y_val` берілсе, әр ағаштан кейін валидация RMSE есептеледі де,
        `patience` ағаш бойы жақсармаса — оқыту тоқтап, ағаштар ЕҢ ЖАҚСЫ
        итерацияға дейін қиылады. Бұл overfitting-тің басты тежегіші.
        """
        X = np.asarray(X, dtype=np.float64)
        y = np.asarray(y, dtype=np.float64)
        n, f = X.shape

        self.edges = [_bin_edges(X[:, j], self.n_bins) for j in range(f)]
        # Әр белгінің қорап саны әртүрлі болуы мүмкін — ортақ B аламыз
        self.B = max(2, max(len(e) + 1 for e in self.edges))
        Xb = np.empty((n, f), dtype=np.int32)
        for j in range(f):
            Xb[:, j] = np.searchsorted(self.edges[j], X[:, j], side="left")

        self._offs = (np.arange(f, dtype=np.int32) * self.B)[None, :]
        self.base = float(y.mean())
        pred = np.full(n, self.base, dtype=np.float64)

        use_val = X_val is not None and y_val is not None
        if use_val:
            X_val = np.asarray(X_val, dtype=np.float64)
            y_val = np.asarray(y_val, dtype=np.float64)
            pred_val = np.full(X_val.shape[0], self.base, dtype=np.float64)
            best_rmse = float(np.sqrt(np.mean((y_val - pred_val) ** 2)))
            best_n, since_best = 0, 0

        for it in range(self.n_trees):
            grad = y - pred  # квадраттық шығынның теріс градиенті
            tree = Tree()
            root = tree.add_node()
            self._grow(tree, root, Xb, grad, np.arange(n, dtype=np.int32), 0)
            pred += self.lr * self._predict_tree_binned(tree, Xb)
            self.trees.append(tree)

            if use_val:
                pred_val += self.lr * _apply(tree, X_val)
                v_rmse = float(np.sqrt(np.mean((y_val - pred_val) ** 2)))
                if v_rmse < best_rmse - 1e-9:
                    best_rmse, best_n, since_best = v_rmse, it + 1, 0
                else:
                    since_best += 1
                if verbose and (it + 1) % 25 == 0:
                    t_rmse = float(np.sqrt(np.mean((y - pred) ** 2)))
                    print(
                        f"    ағаш {it + 1:4d}/{self.n_trees}  оқыту RMSE={t_rmse:.3f}  "
                        f"валидация RMSE={v_rmse:.3f}  (ең жақсы {best_n}: {best_rmse:.3f})"
                    )
                if since_best >= self.patience:
                    print(f"    ⏹ ерте тоқтату: {it + 1} ағаштан кейін жақсару жоқ")
                    break
            elif verbose and (it + 1) % 25 == 0:
                t_rmse = float(np.sqrt(np.mean((y - pred) ** 2)))
                print(f"    ағаш {it + 1:4d}/{self.n_trees}  оқыту RMSE={t_rmse:.3f}")

        if use_val:
            self.trees = self.trees[:best_n]
            self.stopped_at = best_n
            print(f"    ✂ ең жақсы итерация: {best_n} ағаш (валидация RMSE={best_rmse:.3f})")
        return self

    def _grow(self, tree: Tree, node: int, Xb: np.ndarray, grad: np.ndarray,
              idx: np.ndarray, depth: int) -> None:
        m = idx.size
        node_sum = float(grad[idx].sum())
        leaf = node_sum / (m + self.l2)  # L2 регуляризациясы жапырақты тежейді
        if depth >= self.max_depth or m < 2 * self.min_samples_leaf:
            tree.value[node] = leaf
            return

        f = Xb.shape[1]
        codes = (Xb[idx] + self._offs).ravel()
        weights = np.repeat(grad[idx], f)
        g_hist = np.bincount(codes, weights=weights, minlength=f * self.B).reshape(f, self.B)
        c_hist = np.bincount(codes, minlength=f * self.B).reshape(f, self.B).astype(np.float64)

        g_cum = np.cumsum(g_hist, axis=1)
        c_cum = np.cumsum(c_hist, axis=1)
        g_tot, c_tot = node_sum, float(m)

        gl, cl = g_cum[:, :-1], c_cum[:, :-1]
        gr, cr = g_tot - gl, c_tot - cl

        valid = (cl >= self.min_samples_leaf) & (cr >= self.min_samples_leaf)
        with np.errstate(divide="ignore", invalid="ignore"):
            gain = np.where(valid, gl * gl / (cl + self.l2) + gr * gr / (cr + self.l2), -np.inf)
        gain = gain - g_tot * g_tot / (c_tot + self.l2)

        best = int(np.argmax(gain))
        bj, bb = divmod(best, gain.shape[1])
        if not np.isfinite(gain[bj, bb]) or gain[bj, bb] <= self.min_gain:
            tree.value[node] = leaf
            return

        mask = Xb[idx, bj] <= bb
        left_idx, right_idx = idx[mask], idx[~mask]
        if left_idx.size == 0 or right_idx.size == 0:
            tree.value[node] = leaf
            return

        edges = self.edges[bj]
        # bb — қорап нөмірі; шекара мәні = edges[bb] (x ≤ edges[bb] → сол жақ)
        tree.feature[node] = bj
        tree.threshold[node] = float(edges[bb]) if bb < len(edges) else float("inf")
        ln, rn = tree.add_node(), tree.add_node()
        tree.left[node], tree.right[node] = ln, rn
        self._grow(tree, ln, Xb, grad, left_idx, depth + 1)
        self._grow(tree, rn, Xb, grad, right_idx, depth + 1)

    # --- болжам -----------------------------------------------------------
    def _predict_tree_binned(self, tree: Tree, Xb: np.ndarray) -> np.ndarray:
        out = np.zeros(Xb.shape[0], dtype=np.float64)
        stack = [(0, np.arange(Xb.shape[0], dtype=np.int32))]
        while stack:
            node, idx = stack.pop()
            if idx.size == 0:
                continue
            if tree.feature[node] < 0:
                out[idx] = tree.value[node]
                continue
            j = tree.feature[node]
            thr = tree.threshold[node]
            edges = self.edges[j]
            bb = int(np.searchsorted(edges, thr, side="left"))
            mask = Xb[idx, j] <= bb
            stack.append((tree.left[node], idx[mask]))
            stack.append((tree.right[node], idx[~mask]))
        return out

    def predict(self, X: np.ndarray) -> np.ndarray:
        X = np.asarray(X, dtype=np.float64)
        out = np.full(X.shape[0], self.base, dtype=np.float64)
        for tree in self.trees:
            stack = [(0, np.arange(X.shape[0], dtype=np.int32))]
            while stack:
                node, idx = stack.pop()
                if idx.size == 0:
                    continue
                if tree.feature[node] < 0:
                    out[idx] += self.lr * tree.value[node]
                    continue
                mask = X[idx, tree.feature[node]] <= tree.threshold[node]
                stack.append((tree.left[node], idx[mask]))
                stack.append((tree.right[node], idx[~mask]))
        return out

    def to_dict(self) -> dict:
        return {
            "base": round(float(self.base), 6),
            "learningRate": self.lr,
            "nTrees": len(self.trees),
            "stoppedAt": self.stopped_at,
            "trees": [t.to_dict() for t in self.trees],
        }
