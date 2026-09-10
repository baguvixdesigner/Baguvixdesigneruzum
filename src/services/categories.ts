export interface CategorySeed {
  parentGroup: string;
  parentGroupUz: string;
  name: string;
  nameUz: string;
  /** Поисковые запросы на китайском для Oxylabs (Taobao/1688). Первая версия —
   *  проверить и уточнить на реальных результатах пробного доступа Oxylabs. */
  chinaSearchTerms: string[];
}

export const CATEGORY_SEED: CategorySeed[] = [
  // Одежда
  {
    parentGroup: "Одежда",
    parentGroupUz: "Kiyim-kechak",
    name: "Женские блузки и рубашки",
    nameUz: "Ayollar bluzka va ko'ylaklari",
    chinaSearchTerms: ["女士衬衫", "女士雪纺衫"],
  },
  {
    parentGroup: "Одежда",
    parentGroupUz: "Kiyim-kechak",
    name: "Женские юбки",
    nameUz: "Ayollar yubkasi",
    chinaSearchTerms: ["女士半身裙"],
  },
  {
    parentGroup: "Одежда",
    parentGroupUz: "Kiyim-kechak",
    name: "Женские джинсы",
    nameUz: "Ayollar jinsi",
    chinaSearchTerms: ["女士牛仔裤"],
  },
  {
    parentGroup: "Одежда",
    parentGroupUz: "Kiyim-kechak",
    name: "Женское нижнее бельё",
    nameUz: "Ayollar ichki kiyimi",
    chinaSearchTerms: ["女士内衣"],
  },
  {
    parentGroup: "Одежда",
    parentGroupUz: "Kiyim-kechak",
    name: "Женские платья",
    nameUz: "Ayollar ko'ylagi",
    chinaSearchTerms: ["女士连衣裙"],
  },

  // Обувь
  {
    parentGroup: "Обувь",
    parentGroupUz: "Poyabzal",
    name: "Женская обувь",
    nameUz: "Ayollar poyabzali",
    chinaSearchTerms: ["女鞋"],
  },
  {
    parentGroup: "Обувь",
    parentGroupUz: "Poyabzal",
    name: "Детская обувь",
    nameUz: "Bolalar poyabzali",
    chinaSearchTerms: ["童鞋"],
  },

  // Детские товары
  {
    parentGroup: "Детские товары",
    parentGroupUz: "Bolalar tovarlari",
    name: "Детские развивающие игрушки",
    nameUz: "Bolalar rivojlantiruvchi o'yinchoqlari",
    chinaSearchTerms: ["儿童益智玩具"],
  },
  {
    parentGroup: "Детские товары",
    parentGroupUz: "Bolalar tovarlari",
    name: "Детская одежда",
    nameUz: "Bolalar kiyimi",
    chinaSearchTerms: ["童装"],
  },

  // Канцтовары
  {
    parentGroup: "Канцтовары",
    parentGroupUz: "Kantselyariya",
    name: "Канцтовары для школы",
    nameUz: "Maktab uchun kantselyariya",
    chinaSearchTerms: ["学生文具"],
  },
  {
    parentGroup: "Канцтовары",
    parentGroupUz: "Kantselyariya",
    name: "Органайзеры и планинги",
    nameUz: "Organayzer va rejalashtiruvchilar",
    chinaSearchTerms: ["手账本", "文件收纳"],
  },

  // Аксессуары
  {
    parentGroup: "Аксессуары",
    parentGroupUz: "Aksessuarlar",
    name: "Женские сумки",
    nameUz: "Ayollar sumkalari",
    chinaSearchTerms: ["女士包包"],
  },
  {
    parentGroup: "Аксессуары",
    parentGroupUz: "Aksessuarlar",
    name: "Бижутерия",
    nameUz: "Bijuteriya",
    chinaSearchTerms: ["时尚饰品"],
  },

  // Товары для дома
  {
    parentGroup: "Товары для дома",
    parentGroupUz: "Uy uchun tovarlar",
    name: "Кухонные гаджеты",
    nameUz: "Oshxona gadjetlari",
    chinaSearchTerms: ["厨房小工具"],
  },
  {
    parentGroup: "Товары для дома",
    parentGroupUz: "Uy uchun tovarlar",
    name: "Органайзеры для хранения",
    nameUz: "Saqlash uchun organayzerlar",
    chinaSearchTerms: ["收纳整理"],
  },

  // Зоотовары
  {
    parentGroup: "Зоотовары",
    parentGroupUz: "Uy hayvonlari uchun tovarlar",
    name: "Игрушки для кошек и собак",
    nameUz: "Mushuk va itlar uchun o'yinchoqlar",
    chinaSearchTerms: ["猫狗玩具"],
  },
  {
    parentGroup: "Зоотовары",
    parentGroupUz: "Uy hayvonlari uchun tovarlar",
    name: "Автоматические кормушки и поилки",
    nameUz: "Avtomatik oziqlantirgich va suvxo'rlar",
    chinaSearchTerms: ["自动喂食器"],
  },
  {
    parentGroup: "Зоотовары",
    parentGroupUz: "Uy hayvonlari uchun tovarlar",
    name: "Переноски и лежанки",
    nameUz: "Sumka va yotoqchalar",
    chinaSearchTerms: ["宠物窝", "宠物包"],
  },
  {
    parentGroup: "Зоотовары",
    parentGroupUz: "Uy hayvonlari uchun tovarlar",
    name: "Одежда и аксессуары для собак",
    nameUz: "Itlar uchun kiyim va aksessuarlar",
    chinaSearchTerms: ["狗狗衣服"],
  },
  {
    parentGroup: "Зоотовары",
    parentGroupUz: "Uy hayvonlari uchun tovarlar",
    name: "Когтеточки и груминг",
    nameUz: "Tirnoq qirg'ich va parvarish",
    chinaSearchTerms: ["猫抓板", "宠物美容"],
  },
];
