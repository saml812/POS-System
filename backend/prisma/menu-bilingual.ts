/** Format menu labels as "English / 中文". */
export function bi(english: string, chinese: string): string {
  return `${english} / ${chinese}`;
}

export const INGREDIENT_ZH: Record<string, string> = {
  Shrimp: "虾",
  Chicken: "鸡",
  Beef: "牛",
  Ham: "火腿",
  Pork: "猪",
  Meats: "肉类",
  Egg: "蛋",
  Vegetables: "蔬菜",
  Onion: "洋葱",
  Carrot: "胡萝卜",
  Peas: "豌豆",
  Broccoli: "西兰花",
  "Napa Cabbage": "大白菜",
  Celery: "芹菜",
  Sauce: "酱",
  "Brown Sauce": "褐色酱",
  "Sweet & Sour Sauce": "酸甜酱",
  "Hot Sauce": "辣酱",
  Spicy: "辣",
  Noodles: "面",
};

export function extraIngredientName(ingredient: string): string {
  const zh = INGREDIENT_ZH[ingredient] ?? ingredient;
  return bi(`Extra ${ingredient}`, `加${zh}`);
}

export function noIngredientName(ingredient: string): string {
  const zh = INGREDIENT_ZH[ingredient] ?? ingredient;
  return bi(`No ${ingredient}`, `不要${zh}`);
}

export const CATEGORY_NAMES = {
  chefsSpecialties: bi("Chef's Specialties", "招牌菜"),
  specialCombo: bi("Special Combo", "套餐"),
  appetizersSides: bi("Appetizers & Sides", "开胃菜和小菜"),
  soups: bi("Soups", "汤"),
  friedRice: bi("Fried Rice", "炒饭"),
  loMein: bi("Lo Mein", "捞面"),
  vegetable: bi("Vegetable", "蔬菜"),
  chicken: bi("Chicken", "鸡"),
  pork: bi("Pork", "猪"),
  beef: bi("Beef", "牛"),
  shrimp: bi("Shrimp", "虾"),
  drinks: bi("Drinks", "饮料"),
} as const;

export const MENU_COPY = {
  withRice: bi(
    "Served with steamed or fried rice.",
    "附白饭或炒饭。",
  ),
  comboIncluded: bi(
    "Served with ham fried rice and egg roll.",
    "附火腿炒饭和春卷。",
  ),
  spicy: bi("Hot & spicy.", "辣。"),
  friedRiceBase: bi(
    "Cooked with pea, carrot, onion, and egg.",
    "配豌豆、胡萝卜、洋葱和蛋。",
  ),
  loMeinBase: bi(
    "Spaghetti-like noodles with carrot, celery, onion, and napa.",
    "配胡萝卜、芹菜、洋葱和大白菜。",
  ),
  efyDescription: bi(
    "Choose style — shown on kitchen ticket.",
    "选择款式 — 厨房单上显示。",
  ),
  noRice: bi("No Rice", "不要饭"),
  steamRice: bi("Steam Rice", "白饭"),
  friedRice: bi("Fried Rice", "炒饭"),
  small: bi("Small", "小"),
  large: bi("Large", "大"),
  allFlats: bi("All Flats", "全翅中"),
  allDrums: bi("All Drums", "全鸡腿"),
} as const;

export const FRIED_RICE_SWAP_ZH: Record<string, string> = {
  veg: "菜炒饭",
  pork: "猪炒饭",
  chicken: "鸡炒饭",
  ham: "火腿炒饭",
  shrimp: "虾炒饭",
  house: "本楼炒饭",
  beef: "牛炒饭",
};

export const EFY_STYLE_ZH: Record<string, string> = {
  chicken: "鸡芙蓉蛋",
  pork: "猪芙蓉蛋",
  vegetable: "菜芙蓉蛋",
  beef: "牛芙蓉蛋",
  shrimp: "虾芙蓉蛋",
  house: "本楼芙蓉蛋",
};
