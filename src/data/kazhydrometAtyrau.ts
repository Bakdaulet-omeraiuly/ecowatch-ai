// ⚠️ АВТОМАТТЫ ЖАСАЛҒАН ФАЙЛ — қолмен өзгертпе.
// Көзі: validation/kazhydromet (export_ts.py). РМК «Қазгидромет» Атырау
// филиалының ай сайынғы жария бюллетеньдері, «г. Атырау» кестесі (қаланың
// 6 постының жиынтығы). 🛰 ӨЛШЕМ деңгейі — бірақ ТІРІ ЕМЕС: бюллетень
// ~1–1.5 ай кешігіп жарияланады. Тек Атырау аймағына қолданылады.

export type KzhGas = "so2" | "co" | "no2" | "no" | "h2s";

export interface KzhMonth {
  month: string; // YYYY-MM
  meanUg: number; // айлық орташа, мкг/м³
  maxUg: number | null; // максималды бір реттік, мкг/м³
  maxXPdkMr: number | null; // максималды бір реттік / ҚР ШРК м.р.
  page: number; // бюллетеньдегі бет
  url: string; // бюллетень PDF
}

export const KZH_PERIOD = { from: "2024-01", to: "2026-04", bulletins: 28 };

export const KZH_ATYRAU: Record<KzhGas, KzhMonth[]> = {
  so2: [
    {"month": "2024-01", "meanUg": 1.5, "maxUg": 16.0, "maxXPdkMr": 0.0, "page": 5, "url": "https://www.kazhydromet.kz/uploads/files_calendar/4495/file/6682a00ef07e5atyrauskaya-oblast-yanvar-2024.pdf"},
    {"month": "2024-02", "meanUg": 1.5, "maxUg": 25.0, "maxXPdkMr": 0.1, "page": 5, "url": "https://www.kazhydromet.kz/uploads/files_calendar/4601/file/6682a465baf96atyrauskaya-oblast-fevral-rus.pdf"},
    {"month": "2024-03", "meanUg": 9.5, "maxUg": 31.0, "maxXPdkMr": 0.1, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/4710/file/6682a83789165atyrauskaya-oblast-mart-rus.pdf"},
    {"month": "2024-04", "meanUg": 11.0, "maxUg": 47.0, "maxXPdkMr": 0.1, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/4836/file/6682ab58c2e79atyrauskaya-obl-aprel-rus.pdf"},
    {"month": "2024-05", "meanUg": 6.5, "maxUg": 16.0, "maxXPdkMr": 0.0, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/5717/file/6682ada66df2catyrauskaya-oblast-may-rus.pdf"},
    {"month": "2024-06", "meanUg": 10.0, "maxUg": 27.0, "maxXPdkMr": 0.1, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/5832/file/669669bdd2a21atyrau-russ-byulleten-za-iyun-2024.pdf"},
    {"month": "2024-07", "meanUg": 9.0, "maxUg": 25.0, "maxXPdkMr": 0.1, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/5970/file/66bf25db9b37aatyrau-russ-byulleten-za-iyul-2024.pdf"},
    {"month": "2024-08", "meanUg": 11.5, "maxUg": 70.0, "maxXPdkMr": 0.1, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/6090/file/66e82117e86a8atyrau-russ-byulleten-za-avgust-2024.pdf"},
    {"month": "2024-09", "meanUg": 10.5, "maxUg": 31.0, "maxXPdkMr": 0.1, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/6195/file/67126209ac550atyrau-russ-byulleten-za-sentyabr-2024-1.pdf"},
    {"month": "2024-10", "meanUg": 12.5, "maxUg": 130.0, "maxXPdkMr": 0.3, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/6305/file/673712c648df0atyrau-russ-byulleten-za-oktyabr-2024.pdf"},
    {"month": "2024-11", "meanUg": 10.0, "maxUg": 32.0, "maxXPdkMr": 0.1, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/6567/file/675c361a4e90datyrau-russ-byulleten-za-noyabr-2024.pdf"},
    {"month": "2024-12", "meanUg": 9.0, "maxUg": 26.0, "maxXPdkMr": 0.1, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/6706/file/678906891fb90atyrau-russ-byulleten-za-dekabr-2024.pdf"},
    {"month": "2025-01", "meanUg": 6.5, "maxUg": 160.2, "maxXPdkMr": 0.3, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/6880/file/68272811a5b6fatyrau-russ-byulleten-za-yanvar-3.pdf"},
    {"month": "2025-02", "meanUg": 10.0, "maxUg": 216.4, "maxXPdkMr": 0.4, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/7270/file/67d427f67e83eatyrau-russ-byulleten-za-fevral-2025g.pdf"},
    {"month": "2025-03", "meanUg": 9.5, "maxUg": 219.0, "maxXPdkMr": 0.4, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/7880/file/68078de4b7a08atyrau-russ-byulleten-za-mart-2025g.pdf"},
    {"month": "2025-04", "meanUg": 10.0, "maxUg": 216.4, "maxXPdkMr": 0.4, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/8370/file/682c6502c5c49atyrau-russ-byulleten-za-aprel-2025g-2.pdf"},
    {"month": "2025-05", "meanUg": 10.5, "maxUg": 1634.7, "maxXPdkMr": 3.3, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/8606/file/6850158c0099catyrau-russ-byulleten-za-may-2025g.pdf"},
    {"month": "2025-06", "meanUg": 15.0, "maxUg": 7049.5, "maxXPdkMr": 14.1, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/8798/file/6878de8ae1848atyrau-russ-byulleten-za-iyun-2025g-1.pdf"},
    {"month": "2025-07", "meanUg": 13.0, "maxUg": 328.8, "maxXPdkMr": 0.7, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/8985/file/68a2c53ea8e8aatyrau-russ-byulleten-za-iyul-2025g-3.pdf"},
    {"month": "2025-08", "meanUg": 10.0, "maxUg": 1814.2, "maxXPdkMr": 3.6, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/9180/file/68c945a9d6f03atyrau-russ-byulleten-za-avgust-2025g.pdf"},
    {"month": "2025-09", "meanUg": 12.0, "maxUg": 438.5, "maxXPdkMr": 0.9, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/9344/file/68f0e81dcc3caatyrau-russ-byulleten-za-sentyabr-2025g.pdf"},
    {"month": "2025-10", "meanUg": 12.5, "maxUg": 439.7, "maxXPdkMr": 0.9, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/9460/file/69171c1da26aaatyrau-russ-byulleten-za-oktyabr-2025g.pdf"},
    {"month": "2025-11", "meanUg": 14.5, "maxUg": 329.1, "maxXPdkMr": 0.7, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/9610/file/693fff82b14c1atyrau-russ-byulleten-za-noyabr-2025g.pdf"},
    {"month": "2025-12", "meanUg": 13.5, "maxUg": 327.1, "maxXPdkMr": 0.7, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/9780/file/696f0dc396466atyrau-russ-byulleten-za-dekabr-2025g.pdf"},
    {"month": "2026-01", "meanUg": 15.5, "maxUg": 433.4, "maxXPdkMr": 0.9, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/9950/file/69952ec73a1fdatyrau-russ-byulleten-za-yanvar-2026g-1.pdf"},
    {"month": "2026-02", "meanUg": 16.5, "maxUg": 327.2, "maxXPdkMr": 0.7, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/10438/file/69b805abdd433atyrau-russ-byulleten-za-fevral-2026g-2.pdf"},
    {"month": "2026-03", "meanUg": 14.0, "maxUg": 250.0, "maxXPdkMr": 0.5, "page": 5, "url": "https://www.kazhydromet.kz/uploads/files_calendar/11071/file/69e0cd2fb0d50atyrau-russ-byulleten-za-mart-2026g.pdf"},
    {"month": "2026-04", "meanUg": 12.0, "maxUg": 215.9, "maxXPdkMr": 0.4, "page": 5, "url": "https://www.kazhydromet.kz/uploads/files_calendar/11441/file/6a07120d0f768atyrau-russ-byulleten-za-aprel-2026g-1.pdf"},
  ],
  co: [
    {"month": "2024-01", "meanUg": 60.0, "maxUg": 2100.0, "maxXPdkMr": 0.4, "page": 5, "url": "https://www.kazhydromet.kz/uploads/files_calendar/4495/file/6682a00ef07e5atyrauskaya-oblast-yanvar-2024.pdf"},
    {"month": "2024-02", "meanUg": 30.0, "maxUg": 1700.0, "maxXPdkMr": 0.3, "page": 5, "url": "https://www.kazhydromet.kz/uploads/files_calendar/4601/file/6682a465baf96atyrauskaya-oblast-fevral-rus.pdf"},
    {"month": "2024-03", "meanUg": 180.0, "maxUg": 800.0, "maxXPdkMr": 0.2, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/4710/file/6682a83789165atyrauskaya-oblast-mart-rus.pdf"},
    {"month": "2024-04", "meanUg": 180.0, "maxUg": 1410.0, "maxXPdkMr": 0.3, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/4836/file/6682ab58c2e79atyrauskaya-obl-aprel-rus.pdf"},
    {"month": "2024-05", "meanUg": 270.0, "maxUg": 2140.0, "maxXPdkMr": 0.4, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/5717/file/6682ada66df2catyrauskaya-oblast-may-rus.pdf"},
    {"month": "2024-06", "meanUg": 210.0, "maxUg": 1530.0, "maxXPdkMr": 0.3, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/5832/file/669669bdd2a21atyrau-russ-byulleten-za-iyun-2024.pdf"},
    {"month": "2024-07", "meanUg": 270.0, "maxUg": 8000.0, "maxXPdkMr": 1.6, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/5970/file/66bf25db9b37aatyrau-russ-byulleten-za-iyul-2024.pdf"},
    {"month": "2024-08", "meanUg": 330.0, "maxUg": 6000.0, "maxXPdkMr": 1.2, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/6090/file/66e82117e86a8atyrau-russ-byulleten-za-avgust-2024.pdf"},
    {"month": "2024-09", "meanUg": 300.0, "maxUg": 2170.0, "maxXPdkMr": 0.4, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/6195/file/67126209ac550atyrau-russ-byulleten-za-sentyabr-2024-1.pdf"},
    {"month": "2024-10", "meanUg": 210.0, "maxUg": 1310.0, "maxXPdkMr": 0.3, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/6305/file/673712c648df0atyrau-russ-byulleten-za-oktyabr-2024.pdf"},
    {"month": "2024-11", "meanUg": 240.0, "maxUg": 1800.0, "maxXPdkMr": 0.4, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/6567/file/675c361a4e90datyrau-russ-byulleten-za-noyabr-2024.pdf"},
    {"month": "2024-12", "meanUg": 180.0, "maxUg": 1200.0, "maxXPdkMr": 0.2, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/6706/file/678906891fb90atyrau-russ-byulleten-za-dekabr-2024.pdf"},
    {"month": "2025-01", "meanUg": 120.0, "maxUg": 3550.0, "maxXPdkMr": 0.7, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/6880/file/68272811a5b6fatyrau-russ-byulleten-za-yanvar-3.pdf"},
    {"month": "2025-02", "meanUg": 90.0, "maxUg": 1000.0, "maxXPdkMr": 0.2, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/7270/file/67d427f67e83eatyrau-russ-byulleten-za-fevral-2025g.pdf"},
    {"month": "2025-03", "meanUg": 120.0, "maxUg": 42010.0, "maxXPdkMr": 8.4, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/7880/file/68078de4b7a08atyrau-russ-byulleten-za-mart-2025g.pdf"},
    {"month": "2025-04", "meanUg": 90.0, "maxUg": 17470.0, "maxXPdkMr": 3.5, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/8370/file/682c6502c5c49atyrau-russ-byulleten-za-aprel-2025g-2.pdf"},
    {"month": "2025-05", "meanUg": 120.0, "maxUg": 35240.0, "maxXPdkMr": 7.0, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/8606/file/6850158c0099catyrau-russ-byulleten-za-may-2025g.pdf"},
    {"month": "2025-06", "meanUg": 180.0, "maxUg": 80060.0, "maxXPdkMr": 16.0, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/8798/file/6878de8ae1848atyrau-russ-byulleten-za-iyun-2025g-1.pdf"},
    {"month": "2025-07", "meanUg": 120.0, "maxUg": 1310.0, "maxXPdkMr": 0.3, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/8985/file/68a2c53ea8e8aatyrau-russ-byulleten-za-iyul-2025g-3.pdf"},
    {"month": "2025-08", "meanUg": 150.0, "maxUg": 28620.0, "maxXPdkMr": 5.7, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/9180/file/68c945a9d6f03atyrau-russ-byulleten-za-avgust-2025g.pdf"},
    {"month": "2025-09", "meanUg": 120.0, "maxUg": 28620.0, "maxXPdkMr": 5.7, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/9344/file/68f0e81dcc3caatyrau-russ-byulleten-za-sentyabr-2025g.pdf"},
    {"month": "2025-10", "meanUg": 120.0, "maxUg": 32250.0, "maxXPdkMr": 6.5, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/9460/file/69171c1da26aaatyrau-russ-byulleten-za-oktyabr-2025g.pdf"},
    {"month": "2025-11", "meanUg": 120.0, "maxUg": 9530.0, "maxXPdkMr": 1.9, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/9610/file/693fff82b14c1atyrau-russ-byulleten-za-noyabr-2025g.pdf"},
    {"month": "2025-12", "meanUg": 120.0, "maxUg": 13080.0, "maxXPdkMr": 2.6, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/9780/file/696f0dc396466atyrau-russ-byulleten-za-dekabr-2025g.pdf"},
    {"month": "2026-01", "meanUg": 90.0, "maxUg": 5980.0, "maxXPdkMr": 1.2, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/9950/file/69952ec73a1fdatyrau-russ-byulleten-za-yanvar-2026g-1.pdf"},
    {"month": "2026-02", "meanUg": 90.0, "maxUg": 1450.0, "maxXPdkMr": 0.3, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/10438/file/69b805abdd433atyrau-russ-byulleten-za-fevral-2026g-2.pdf"},
    {"month": "2026-03", "meanUg": 90.0, "maxUg": 1870.0, "maxXPdkMr": 0.4, "page": 5, "url": "https://www.kazhydromet.kz/uploads/files_calendar/11071/file/69e0cd2fb0d50atyrau-russ-byulleten-za-mart-2026g.pdf"},
    {"month": "2026-04", "meanUg": 120.0, "maxUg": 39250.0, "maxXPdkMr": 7.9, "page": 5, "url": "https://www.kazhydromet.kz/uploads/files_calendar/11441/file/6a07120d0f768atyrau-russ-byulleten-za-aprel-2026g-1.pdf"},
  ],
  no2: [
    {"month": "2024-01", "meanUg": 2.8, "maxUg": 110.0, "maxXPdkMr": 0.5, "page": 5, "url": "https://www.kazhydromet.kz/uploads/files_calendar/4495/file/6682a00ef07e5atyrauskaya-oblast-yanvar-2024.pdf"},
    {"month": "2024-02", "meanUg": 2.8, "maxUg": 120.0, "maxXPdkMr": 0.6, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/4601/file/6682a465baf96atyrauskaya-oblast-fevral-rus.pdf"},
    {"month": "2024-03", "meanUg": 16.4, "maxUg": 110.0, "maxXPdkMr": 0.5, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/4710/file/6682a83789165atyrauskaya-oblast-mart-rus.pdf"},
    {"month": "2024-04", "meanUg": 18.4, "maxUg": 680.0, "maxXPdkMr": 3.4, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/4836/file/6682ab58c2e79atyrauskaya-obl-aprel-rus.pdf"},
    {"month": "2024-05", "meanUg": 15.6, "maxUg": 160.0, "maxXPdkMr": 0.8, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/5717/file/6682ada66df2catyrauskaya-oblast-may-rus.pdf"},
    {"month": "2024-06", "meanUg": 18.0, "maxUg": 250.0, "maxXPdkMr": 1.2, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/5832/file/669669bdd2a21atyrau-russ-byulleten-za-iyun-2024.pdf"},
    {"month": "2024-07", "meanUg": 17.2, "maxUg": 140.0, "maxXPdkMr": 0.7, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/5970/file/66bf25db9b37aatyrau-russ-byulleten-za-iyul-2024.pdf"},
    {"month": "2024-08", "meanUg": 16.0, "maxUg": 80.0, "maxXPdkMr": 0.4, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/6090/file/66e82117e86a8atyrau-russ-byulleten-za-avgust-2024.pdf"},
    {"month": "2024-09", "meanUg": 17.2, "maxUg": 190.0, "maxXPdkMr": 1.0, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/6195/file/67126209ac550atyrau-russ-byulleten-za-sentyabr-2024-1.pdf"},
    {"month": "2024-10", "meanUg": 24.8, "maxUg": 210.0, "maxXPdkMr": 1.1, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/6305/file/673712c648df0atyrau-russ-byulleten-za-oktyabr-2024.pdf"},
    {"month": "2024-11", "meanUg": 16.4, "maxUg": 190.0, "maxXPdkMr": 1.0, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/6567/file/675c361a4e90datyrau-russ-byulleten-za-noyabr-2024.pdf"},
    {"month": "2024-12", "meanUg": 15.2, "maxUg": 80.0, "maxXPdkMr": 0.4, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/6706/file/678906891fb90atyrau-russ-byulleten-za-dekabr-2024.pdf"},
    {"month": "2025-01", "meanUg": 170.8, "maxUg": 1650.0, "maxXPdkMr": 8.3, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/6880/file/68272811a5b6fatyrau-russ-byulleten-za-yanvar-3.pdf"},
    {"month": "2025-02", "meanUg": 325.6, "maxUg": 2000.0, "maxXPdkMr": 9.98, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/7270/file/67d427f67e83eatyrau-russ-byulleten-za-fevral-2025g.pdf"},
    {"month": "2025-03", "meanUg": 207.2, "maxUg": 2220.0, "maxXPdkMr": 11.11, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/7880/file/68078de4b7a08atyrau-russ-byulleten-za-mart-2025g.pdf"},
    {"month": "2025-04", "meanUg": 112.4, "maxUg": 1420.0, "maxXPdkMr": 7.12, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/8370/file/682c6502c5c49atyrau-russ-byulleten-za-aprel-2025g-2.pdf"},
    {"month": "2025-05", "meanUg": 64.0, "maxUg": 1150.0, "maxXPdkMr": 5.77, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/8606/file/6850158c0099catyrau-russ-byulleten-za-may-2025g.pdf"},
    {"month": "2025-06", "meanUg": 73.2, "maxUg": 1230.0, "maxXPdkMr": 6.15, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/8798/file/6878de8ae1848atyrau-russ-byulleten-za-iyun-2025g-1.pdf"},
    {"month": "2025-07", "meanUg": 11.6, "maxUg": 690.0, "maxXPdkMr": 3.46, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/8985/file/68a2c53ea8e8aatyrau-russ-byulleten-za-iyul-2025g-3.pdf"},
    {"month": "2025-08", "meanUg": 24.4, "maxUg": 1020.0, "maxXPdkMr": 5.12, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/9180/file/68c945a9d6f03atyrau-russ-byulleten-za-avgust-2025g.pdf"},
    {"month": "2025-09", "meanUg": 28.0, "maxUg": 1020.0, "maxXPdkMr": 5.12, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/9344/file/68f0e81dcc3caatyrau-russ-byulleten-za-sentyabr-2025g.pdf"},
    {"month": "2025-10", "meanUg": 48.0, "maxUg": 760.0, "maxXPdkMr": 3.79, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/9460/file/69171c1da26aaatyrau-russ-byulleten-za-oktyabr-2025g.pdf"},
    {"month": "2025-11", "meanUg": 61.2, "maxUg": 640.0, "maxXPdkMr": 3.18, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/9610/file/693fff82b14c1atyrau-russ-byulleten-za-noyabr-2025g.pdf"},
    {"month": "2025-12", "meanUg": 52.4, "maxUg": 980.0, "maxXPdkMr": 4.91, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/9780/file/696f0dc396466atyrau-russ-byulleten-za-dekabr-2025g.pdf"},
    {"month": "2026-01", "meanUg": 68.4, "maxUg": 1150.0, "maxXPdkMr": 5.8, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/9950/file/69952ec73a1fdatyrau-russ-byulleten-za-yanvar-2026g-1.pdf"},
    {"month": "2026-02", "meanUg": 48.4, "maxUg": 630.0, "maxXPdkMr": 3.2, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/10438/file/69b805abdd433atyrau-russ-byulleten-za-fevral-2026g-2.pdf"},
    {"month": "2026-03", "meanUg": 40.8, "maxUg": 630.0, "maxXPdkMr": 3.2, "page": 5, "url": "https://www.kazhydromet.kz/uploads/files_calendar/11071/file/69e0cd2fb0d50atyrau-russ-byulleten-za-mart-2026g.pdf"},
    {"month": "2026-04", "meanUg": 29.6, "maxUg": 400.0, "maxXPdkMr": 2.0, "page": 5, "url": "https://www.kazhydromet.kz/uploads/files_calendar/11441/file/6a07120d0f768atyrau-russ-byulleten-za-aprel-2026g-1.pdf"},
  ],
  no: [
    {"month": "2024-01", "meanUg": 11.4, "maxUg": 70.0, "maxXPdkMr": 0.2, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/4495/file/6682a00ef07e5atyrauskaya-oblast-yanvar-2024.pdf"},
    {"month": "2024-02", "meanUg": 8.4, "maxUg": 130.0, "maxXPdkMr": 0.3, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/4601/file/6682a465baf96atyrauskaya-oblast-fevral-rus.pdf"},
    {"month": "2024-03", "meanUg": 21.0, "maxUg": 90.0, "maxXPdkMr": 0.2, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/4710/file/6682a83789165atyrauskaya-oblast-mart-rus.pdf"},
    {"month": "2024-04", "meanUg": 27.6, "maxUg": 60.0, "maxXPdkMr": 0.2, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/4836/file/6682ab58c2e79atyrauskaya-obl-aprel-rus.pdf"},
    {"month": "2024-05", "meanUg": 15.6, "maxUg": 150.0, "maxXPdkMr": 0.4, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/5717/file/6682ada66df2catyrauskaya-oblast-may-rus.pdf"},
    {"month": "2024-06", "meanUg": 19.8, "maxUg": 350.0, "maxXPdkMr": 0.9, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/5832/file/669669bdd2a21atyrau-russ-byulleten-za-iyun-2024.pdf"},
    {"month": "2024-07", "meanUg": 5.4, "maxUg": 210.0, "maxXPdkMr": 0.5, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/5970/file/66bf25db9b37aatyrau-russ-byulleten-za-iyul-2024.pdf"},
    {"month": "2024-08", "meanUg": 13.8, "maxUg": 100.0, "maxXPdkMr": 0.3, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/6090/file/66e82117e86a8atyrau-russ-byulleten-za-avgust-2024.pdf"},
    {"month": "2024-09", "meanUg": 8.4, "maxUg": 290.0, "maxXPdkMr": 0.7, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/6195/file/67126209ac550atyrau-russ-byulleten-za-sentyabr-2024-1.pdf"},
    {"month": "2024-10", "meanUg": 9.0, "maxUg": 290.0, "maxXPdkMr": 0.7, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/6305/file/673712c648df0atyrau-russ-byulleten-za-oktyabr-2024.pdf"},
    {"month": "2024-11", "meanUg": 8.4, "maxUg": 290.0, "maxXPdkMr": 0.7, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/6567/file/675c361a4e90datyrau-russ-byulleten-za-noyabr-2024.pdf"},
    {"month": "2024-12", "meanUg": 6.6, "maxUg": 80.0, "maxXPdkMr": 0.2, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/6706/file/678906891fb90atyrau-russ-byulleten-za-dekabr-2024.pdf"},
    {"month": "2025-01", "meanUg": 14.4, "maxUg": 60.0, "maxXPdkMr": 0.1, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/6880/file/68272811a5b6fatyrau-russ-byulleten-za-yanvar-3.pdf"},
    {"month": "2025-02", "meanUg": 12.0, "maxUg": 40.0, "maxXPdkMr": 0.1, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/7270/file/67d427f67e83eatyrau-russ-byulleten-za-fevral-2025g.pdf"},
    {"month": "2025-03", "meanUg": 13.2, "maxUg": 70.0, "maxXPdkMr": 0.2, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/7880/file/68078de4b7a08atyrau-russ-byulleten-za-mart-2025g.pdf"},
    {"month": "2025-04", "meanUg": 12.6, "maxUg": 370.0, "maxXPdkMr": 0.9, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/8370/file/682c6502c5c49atyrau-russ-byulleten-za-aprel-2025g-2.pdf"},
    {"month": "2025-05", "meanUg": 13.8, "maxUg": 480.0, "maxXPdkMr": 1.2, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/8606/file/6850158c0099catyrau-russ-byulleten-za-may-2025g.pdf"},
    {"month": "2025-06", "meanUg": 13.8, "maxUg": 30.0, "maxXPdkMr": 0.1, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/8798/file/6878de8ae1848atyrau-russ-byulleten-za-iyun-2025g-1.pdf"},
    {"month": "2025-07", "meanUg": 13.2, "maxUg": 200.0, "maxXPdkMr": 0.5, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/8985/file/68a2c53ea8e8aatyrau-russ-byulleten-za-iyul-2025g-3.pdf"},
    {"month": "2025-08", "meanUg": 13.8, "maxUg": 100.0, "maxXPdkMr": 0.3, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/9180/file/68c945a9d6f03atyrau-russ-byulleten-za-avgust-2025g.pdf"},
    {"month": "2025-09", "meanUg": 13.2, "maxUg": 80.0, "maxXPdkMr": 0.2, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/9344/file/68f0e81dcc3caatyrau-russ-byulleten-za-sentyabr-2025g.pdf"},
    {"month": "2025-10", "meanUg": 14.4, "maxUg": 170.0, "maxXPdkMr": 0.4, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/9460/file/69171c1da26aaatyrau-russ-byulleten-za-oktyabr-2025g.pdf"},
    {"month": "2025-11", "meanUg": 17.4, "maxUg": 50.0, "maxXPdkMr": 0.1, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/9610/file/693fff82b14c1atyrau-russ-byulleten-za-noyabr-2025g.pdf"},
    {"month": "2025-12", "meanUg": 15.6, "maxUg": 70.0, "maxXPdkMr": 0.2, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/9780/file/696f0dc396466atyrau-russ-byulleten-za-dekabr-2025g.pdf"},
    {"month": "2026-01", "meanUg": 16.2, "maxUg": 70.0, "maxXPdkMr": 0.2, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/9950/file/69952ec73a1fdatyrau-russ-byulleten-za-yanvar-2026g-1.pdf"},
    {"month": "2026-02", "meanUg": 14.4, "maxUg": 30.0, "maxXPdkMr": 0.1, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/10438/file/69b805abdd433atyrau-russ-byulleten-za-fevral-2026g-2.pdf"},
    {"month": "2026-03", "meanUg": 13.2, "maxUg": 50.0, "maxXPdkMr": 0.1, "page": 5, "url": "https://www.kazhydromet.kz/uploads/files_calendar/11071/file/69e0cd2fb0d50atyrau-russ-byulleten-za-mart-2026g.pdf"},
    {"month": "2026-04", "meanUg": 13.8, "maxUg": 200.0, "maxXPdkMr": 0.5, "page": 5, "url": "https://www.kazhydromet.kz/uploads/files_calendar/11441/file/6a07120d0f768atyrau-russ-byulleten-za-aprel-2026g-1.pdf"},
  ],
  h2s: [
    {"month": "2024-01", "meanUg": 0.3, "maxUg": 1300.0, "maxXPdkMr": 1.3, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/4495/file/6682a00ef07e5atyrauskaya-oblast-yanvar-2024.pdf"},
    {"month": "2024-02", "meanUg": 0.2, "maxUg": 800.0, "maxXPdkMr": 0.0, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/4601/file/6682a465baf96atyrauskaya-oblast-fevral-rus.pdf"},
    {"month": "2024-03", "meanUg": 1.5, "maxUg": 1800.0, "maxXPdkMr": 3.0, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/4710/file/6682a83789165atyrauskaya-oblast-mart-rus.pdf"},
    {"month": "2024-04", "meanUg": 1.8, "maxUg": 1800.0, "maxXPdkMr": 10.3, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/4836/file/6682ab58c2e79atyrauskaya-obl-aprel-rus.pdf"},
    {"month": "2024-05", "meanUg": 1.8, "maxUg": 1500.0, "maxXPdkMr": 4.2, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/5717/file/6682ada66df2catyrauskaya-oblast-may-rus.pdf"},
    {"month": "2024-06", "meanUg": 2.2, "maxUg": 14.0, "maxXPdkMr": 1.8, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/5832/file/669669bdd2a21atyrau-russ-byulleten-za-iyun-2024.pdf"},
    {"month": "2024-07", "meanUg": 3.0, "maxUg": 18.0, "maxXPdkMr": 2.3, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/5970/file/66bf25db9b37aatyrau-russ-byulleten-za-iyul-2024.pdf"},
    {"month": "2024-08", "meanUg": 2.4, "maxUg": 20.0, "maxXPdkMr": 2.5, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/6090/file/66e82117e86a8atyrau-russ-byulleten-za-avgust-2024.pdf"},
    {"month": "2024-09", "meanUg": 2.3, "maxUg": 8.0, "maxXPdkMr": 1.0, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/6195/file/67126209ac550atyrau-russ-byulleten-za-sentyabr-2024-1.pdf"},
    {"month": "2024-10", "meanUg": 2.2, "maxUg": 9.0, "maxXPdkMr": 1.1, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/6305/file/673712c648df0atyrau-russ-byulleten-za-oktyabr-2024.pdf"},
    {"month": "2024-11", "meanUg": 2.1, "maxUg": 21.0, "maxXPdkMr": 2.6, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/6567/file/675c361a4e90datyrau-russ-byulleten-za-noyabr-2024.pdf"},
    {"month": "2024-12", "meanUg": 1.4, "maxUg": 8.0, "maxXPdkMr": 1.0, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/6706/file/678906891fb90atyrau-russ-byulleten-za-dekabr-2024.pdf"},
    {"month": "2025-01", "meanUg": 1.1, "maxUg": 9.0, "maxXPdkMr": 1.1, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/6880/file/68272811a5b6fatyrau-russ-byulleten-za-yanvar-3.pdf"},
    {"month": "2025-02", "meanUg": 3.1, "maxUg": 13.9, "maxXPdkMr": 1.7, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/7270/file/67d427f67e83eatyrau-russ-byulleten-za-fevral-2025g.pdf"},
    {"month": "2025-03", "meanUg": 3.1, "maxUg": 13.5, "maxXPdkMr": 1.7, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/7880/file/68078de4b7a08atyrau-russ-byulleten-za-mart-2025g.pdf"},
    {"month": "2025-04", "meanUg": 3.0, "maxUg": 14.5, "maxXPdkMr": 1.8, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/8370/file/682c6502c5c49atyrau-russ-byulleten-za-aprel-2025g-2.pdf"},
    {"month": "2025-05", "meanUg": 2.8, "maxUg": 14.3, "maxXPdkMr": 1.8, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/8606/file/6850158c0099catyrau-russ-byulleten-za-may-2025g.pdf"},
    {"month": "2025-06", "meanUg": 3.1, "maxUg": 157.5, "maxXPdkMr": 19.7, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/8798/file/6878de8ae1848atyrau-russ-byulleten-za-iyun-2025g-1.pdf"},
    {"month": "2025-07", "meanUg": 1.3, "maxUg": 16.0, "maxXPdkMr": 2.0, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/8985/file/68a2c53ea8e8aatyrau-russ-byulleten-za-iyul-2025g-3.pdf"},
    {"month": "2025-08", "meanUg": 0.8, "maxUg": 22.0, "maxXPdkMr": 2.8, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/9180/file/68c945a9d6f03atyrau-russ-byulleten-za-avgust-2025g.pdf"},
    {"month": "2025-09", "meanUg": 0.9, "maxUg": 14.0, "maxXPdkMr": 1.8, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/9344/file/68f0e81dcc3caatyrau-russ-byulleten-za-sentyabr-2025g.pdf"},
    {"month": "2025-10", "meanUg": 0.7, "maxUg": 70.2, "maxXPdkMr": 8.8, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/9460/file/69171c1da26aaatyrau-russ-byulleten-za-oktyabr-2025g.pdf"},
    {"month": "2025-11", "meanUg": 0.8, "maxUg": 10.0, "maxXPdkMr": 1.3, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/9610/file/693fff82b14c1atyrau-russ-byulleten-za-noyabr-2025g.pdf"},
    {"month": "2025-12", "meanUg": 0.7, "maxUg": 20.0, "maxXPdkMr": 2.5, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/9780/file/696f0dc396466atyrau-russ-byulleten-za-dekabr-2025g.pdf"},
    {"month": "2026-01", "meanUg": 0.8, "maxUg": 17.0, "maxXPdkMr": 2.1, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/9950/file/69952ec73a1fdatyrau-russ-byulleten-za-yanvar-2026g-1.pdf"},
    {"month": "2026-02", "meanUg": 0.7, "maxUg": 3.0, "maxXPdkMr": 0.4, "page": 6, "url": "https://www.kazhydromet.kz/uploads/files_calendar/10438/file/69b805abdd433atyrau-russ-byulleten-za-fevral-2026g-2.pdf"},
    {"month": "2026-03", "meanUg": 0.6, "maxUg": 3.0, "maxXPdkMr": 0.4, "page": 5, "url": "https://www.kazhydromet.kz/uploads/files_calendar/11071/file/69e0cd2fb0d50atyrau-russ-byulleten-za-mart-2026g.pdf"},
    {"month": "2026-04", "meanUg": 0.7, "maxUg": 34.0, "maxXPdkMr": 4.3, "page": 5, "url": "https://www.kazhydromet.kz/uploads/files_calendar/11441/file/6a07120d0f768atyrau-russ-byulleten-za-aprel-2026g-1.pdf"},
  ],
};

/**
 * CAMS-тың Атыраудағы ауытқуы (validation/kazhydromet/results.md).
 * obsOverCams — посттар / CAMS айлық орташа қатынасының медианасы.
 */
export const KZH_CAMS_VALIDATION: Partial<Record<KzhGas, { n: number; obsOverCams: number; nmb: number; pass: boolean }>> = {
  "so2": {
    "n": 28,
    "obsOverCams": 2.3,
    "nmb": -0.486,
    "pass": false
  },
  "co": {
    "n": 28,
    "obsOverCams": 0.7,
    "nmb": 0.291,
    "pass": false
  },
  "no2": {
    "n": 26,
    "obsOverCams": 13.4,
    "nmb": -0.961,
    "pass": false
  },
  "no": {
    "n": 19,
    "obsOverCams": 95.2,
    "nmb": -0.989,
    "pass": false
  }
};

export function latestKzh(gas: KzhGas): KzhMonth | null {
  const s = KZH_ATYRAU[gas];
  return s.length ? s[s.length - 1] : null;
}
