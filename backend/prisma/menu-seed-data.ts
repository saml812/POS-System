import {
  bi,
  CATEGORY_NAMES,
  EFY_STYLE_ZH,
  extraIngredientName,
  FRIED_RICE_SWAP_ZH,
  MENU_COPY,
  noIngredientName,
} from "./menu-bilingual.js";

export type SeedModifier = {
  id: string;
  name: string;
  priceDelta: number;
  sortOrder: number;
  group?: string;
};

export type SeedItem = {
  id: string;
  itemNumber: string | null;
  name: string;
  description: string;
  price: number;
  sortOrder: number;
  options?: SeedModifier[];
  sizes?: SeedModifier[];
};

export type SeedCategory = {
  id: string;
  name: string;
  sortOrder: number;
  items: SeedItem[];
};

type CustomizationMode = false | "ingredients" | "with-rice" | "combo";

const CUSTOMIZABLE_INGREDIENTS = [
  "Shrimp",
  "Chicken",
  "Beef",
  "Ham",
  "Pork",
  "Meats",
  "Egg",
  "Vegetables",
  "Onion",
  "Carrot",
  "Peas",
  "Broccoli",
  "Napa Cabbage",
  "Celery",
  "Sauce",
  "Brown Sauce",
  "Sweet & Sour Sauce",
  "Hot Sauce",
  "Spicy",
  "Noodles",
] as const;

const WINGS_STYLE_EXTRA = 1;

const PROTEIN_EXTRA_PRICE = 3.5;
const MEATS_EXTRA_PRICE = 4.5;
const BEEF_EXTRA_PRICE = 4;
const BROCCOLI_EXTRA_PRICE = 3.5;
const SAUCE_EXTRA_PRICE = 1;
const DEFAULT_EXTRA_PRICE = 1.5;

const FRIED_RICE_SWAPS = [
  { name: "Vegetable Fried Rice", key: "veg", price: 3.5 },
  { name: "Pork Fried Rice", key: "pork", price: 3.5 },
  { name: "Chicken Fried Rice", key: "chicken", price: 3.5 },
  { name: "Ham Fried Rice", key: "ham", price: 3.5 },
  { name: "Shrimp Fried Rice", key: "shrimp", price: 3.5 },
  { name: "House Fried Rice", key: "house", price: 4 },
  { name: "Beef Fried Rice", key: "beef", price: 4 },
] as const;

function slug(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function extraPrice(ingredient: (typeof CUSTOMIZABLE_INGREDIENTS)[number]): number {
  if (ingredient === "Broccoli") return BROCCOLI_EXTRA_PRICE;

  if (
    ingredient === "Egg" ||
    ingredient === "Chicken" ||
    ingredient === "Pork" ||
    ingredient === "Ham" ||
    ingredient === "Shrimp"
  ) {
    return PROTEIN_EXTRA_PRICE;
  }

  if (ingredient === "Beef") return BEEF_EXTRA_PRICE;

  if (ingredient === "Meats") return MEATS_EXTRA_PRICE;

  if (
    ingredient === "Sauce" ||
    ingredient === "Brown Sauce" ||
    ingredient === "Sweet & Sour Sauce" ||
    ingredient === "Hot Sauce" ||
    ingredient === "Spicy"
  ) {
    return SAUCE_EXTRA_PRICE;
  }

  return DEFAULT_EXTRA_PRICE;
}

function ingredientOptions(itemId: string, startOrder: number): SeedModifier[] {
  const options: SeedModifier[] = [];
  let sortOrder = startOrder;

  for (const ingredient of CUSTOMIZABLE_INGREDIENTS) {
    const key = slug(ingredient);
    options.push(
      {
        id: `${itemId}-extra-${key}`,
        name: extraIngredientName(ingredient),
        priceDelta: extraPrice(ingredient),
        sortOrder: sortOrder++,
      },
      {
        id: `${itemId}-no-${key}`,
        name: noIngredientName(ingredient),
        priceDelta: 0,
        sortOrder: sortOrder++,
      },
    );
  }

  return options;
}

function wingsStyleOptions(itemId: string, startOrder: number): SeedModifier[] {
  return [
    {
      id: `${itemId}-wings-flats`,
      name: MENU_COPY.allFlats,
      priceDelta: WINGS_STYLE_EXTRA,
      sortOrder: startOrder,
      group: "wings",
    },
    {
      id: `${itemId}-wings-drums`,
      name: MENU_COPY.allDrums,
      priceDelta: WINGS_STYLE_EXTRA,
      sortOrder: startOrder + 1,
      group: "wings",
    },
  ];
}

function riceSideOptions(itemId: string, mode: "with-rice" | "combo"): SeedModifier[] {
  const options: SeedModifier[] = [];
  let sortOrder = 0;

  if (mode === "combo") {
    options.push({
      id: `${itemId}-rice-ham`,
      name: bi("Ham Fried Rice", FRIED_RICE_SWAP_ZH.ham),
      priceDelta: 0,
      sortOrder: sortOrder++,
      group: "rice",
    });
  }

  options.push({
    id: `${itemId}-rice-none`,
    name: MENU_COPY.noRice,
    priceDelta: 0,
    sortOrder: sortOrder++,
    group: "rice",
  });

  if (mode === "with-rice") {
    options.push(
      {
        id: `${itemId}-rice-steam`,
        name: MENU_COPY.steamRice,
        priceDelta: 0,
        sortOrder: sortOrder++,
        group: "rice",
      },
      {
        id: `${itemId}-rice-fried`,
        name: MENU_COPY.friedRice,
        priceDelta: 0,
        sortOrder: sortOrder++,
        group: "rice",
      },
    );
  }

  for (const swap of FRIED_RICE_SWAPS) {
    if (mode === "combo" && swap.key === "ham") continue;

    options.push({
      id: `${itemId}-rice-${swap.key}`,
      name: bi(swap.name, FRIED_RICE_SWAP_ZH[swap.key]),
      priceDelta: swap.price,
      sortOrder: sortOrder++,
      group: "rice",
    });
  }

  return options;
}

function buildOptions(
  itemId: string,
  mode: CustomizationMode,
  wingsStyle = false,
): SeedModifier[] | undefined {
  if (!mode) {
    return wingsStyle ? wingsStyleOptions(itemId, 0) : undefined;
  }

  if (mode === "ingredients") {
    const options = ingredientOptions(itemId, 0);
    if (!wingsStyle) return options;
    return [...options, ...wingsStyleOptions(itemId, options.length)];
  }

  const riceOptions = riceSideOptions(itemId, mode);
  let sortOrder = riceOptions.length;
  const options = [...riceOptions];

  if (wingsStyle) {
    options.push(...wingsStyleOptions(itemId, sortOrder));
    sortOrder += 2;
  }

  options.push(...ingredientOptions(itemId, sortOrder));
  return options;
}

function fixedItem(
  id: string,
  itemNumber: string | null,
  name: string,
  description: string,
  price: number,
  sortOrder: number,
  customization: CustomizationMode = false,
  wingsStyle = false,
): SeedItem {
  return {
    id,
    itemNumber,
    name,
    description,
    price,
    sortOrder,
    options: buildOptions(id, customization, wingsStyle),
  };
}

function smallLargeSizes(itemId: string, small: number, large: number): SeedModifier[] {
  return [
    {
      id: `${itemId}-small`,
      name: MENU_COPY.small,
      priceDelta: small,
      sortOrder: 0,
    },
    {
      id: `${itemId}-large`,
      name: MENU_COPY.large,
      priceDelta: large,
      sortOrder: 1,
    },
  ];
}

function sizedItem(
  id: string,
  itemNumber: string | null,
  name: string,
  description: string,
  smallPrice: number,
  largePrice: number,
  sortOrder: number,
  customization: CustomizationMode = false,
): SeedItem {
  return {
    id,
    itemNumber,
    name,
    description,
    price: 0,
    sortOrder,
    sizes: smallLargeSizes(id, smallPrice, largePrice),
    options: buildOptions(id, customization),
  };
}

const WITH_RICE = MENU_COPY.withRice;
const COMBO_INCLUDED = MENU_COPY.comboIncluded;
const SPICY = MENU_COPY.spicy;

export const Menu: SeedCategory[] = [
  {
    id: "chefs-specialties",
    name: CATEGORY_NAMES.chefsSpecialties,
    sortOrder: 0,
    items: [
      fixedItem(
        "happy-family",
        "1",
        bi("Happy Family", "合家欢"),
        bi(
          "Shrimp, beef, chicken, pork, and vegetables stir fried in brown sauce.",
          "虾、牛、鸡、猪和蔬菜用褐色酱炒。",
        ) + ` ${WITH_RICE}`,
        15,
        0,
        "with-rice",
      ),
      fixedItem(
        "triple-delight",
        "3",
        bi("Triple Delight", "三宝"),
        bi(
          "Shrimp, beef, and chicken stir fried in brown sauce.",
          "虾、牛和鸡用褐色酱炒。",
        ) + ` ${WITH_RICE}`,
        15,
        1,
        "with-rice",
      ),
      fixedItem(
        "orange-chicken",
        "4",
        bi("Orange Chicken", "陈皮鸡"),
        `${SPICY} ${WITH_RICE}`,
        13,
        2,
        "with-rice",
      ),
      fixedItem(
        "chow-mein",
        "5",
        bi("Chow Mein", "炒面"),
        bi(
          "Chicken, pork, beef, shrimp, and vegetables with crispy noodles.",
          "鸡、猪、牛、虾和蔬菜配脆面。",
        ) + ` ${WITH_RICE}`,
        11,
        3,
        "with-rice",
      ),
      fixedItem(
        "chop-suey",
        "6",
        bi("Chop Suey", "杂碎"),
        bi(
          "Chicken, pork, beef, shrimp, and vegetables.",
          "鸡、猪、牛、虾和蔬菜。",
        ) + ` ${WITH_RICE}`,
        11,
        4,
        "with-rice",
      ),
      {
        id: "egg-foo-young",
        itemNumber: "7",
        name: bi("Egg Foo Young", "芙蓉蛋"),
        description: MENU_COPY.efyDescription,
        price: 0,
        sortOrder: 5,
        sizes: [
          {
            id: "egg-foo-young-chicken",
            name: bi("Chicken EFY", EFY_STYLE_ZH.chicken),
            priceDelta: 11,
            sortOrder: 0,
          },
          {
            id: "egg-foo-young-pork",
            name: bi("Pork EFY", EFY_STYLE_ZH.pork),
            priceDelta: 11,
            sortOrder: 1,
          },
          {
            id: "egg-foo-young-vegetable",
            name: bi("Vegetable EFY", EFY_STYLE_ZH.vegetable),
            priceDelta: 11,
            sortOrder: 2,
          },
          {
            id: "egg-foo-young-beef",
            name: bi("Beef EFY", EFY_STYLE_ZH.beef),
            priceDelta: 12,
            sortOrder: 3,
          },
          {
            id: "egg-foo-young-shrimp",
            name: bi("Shrimp EFY", EFY_STYLE_ZH.shrimp),
            priceDelta: 12,
            sortOrder: 4,
          },
          {
            id: "egg-foo-young-house",
            name: bi("House EFY", EFY_STYLE_ZH.house),
            priceDelta: 12,
            sortOrder: 5,
          },
        ],
        options: buildOptions("egg-foo-young", "ingredients"),
      },
    ],
  },
  {
    id: "special-combo",
    name: CATEGORY_NAMES.specialCombo,
    sortOrder: 1,
    items: [
      fixedItem(
        "combo-chicken-on-stick",
        "C1",
        bi("Chicken on Stick", "串鸡"),
        COMBO_INCLUDED,
        11,
        0,
        "combo",
      ),
      fixedItem(
        "combo-chicken-wings",
        "C2",
        bi("Chicken Wings", "鸡翅"),
        COMBO_INCLUDED,
        11,
        1,
        "combo",
        true,
      ),
      fixedItem(
        "combo-general-tsos",
        "C3",
        bi("General Tso's Chicken", "左宗鸡"),
        `${SPICY} ${COMBO_INCLUDED}`,
        11,
        2,
        "combo",
      ),
      fixedItem(
        "combo-sweet-sour-chicken",
        "C4",
        bi("Sweet & Sour Chicken", "甜酸鸡"),
        COMBO_INCLUDED,
        11,
        3,
        "combo",
      ),
      fixedItem(
        "combo-chicken-broccoli",
        "C5",
        bi("Chicken w/ Broccoli", "鸡西兰花"),
        COMBO_INCLUDED,
        11,
        4,
        "combo",
      ),
      fixedItem(
        "combo-sesame-chicken",
        "C6",
        bi("Sesame Chicken", "芝麻鸡"),
        COMBO_INCLUDED,
        11,
        5,
        "combo",
      ),
      fixedItem(
        "combo-beef-broccoli",
        "C9",
        bi("Beef w/ Broccoli", "牛西兰花"),
        COMBO_INCLUDED,
        11,
        6,
        "combo",
      ),
      fixedItem(
        "combo-pepper-steak",
        "C10",
        bi("Pepper Steak", "胡椒牛"),
        COMBO_INCLUDED,
        11,
        7,
        "combo",
      ),
      fixedItem(
        "combo-mongolian-pork",
        "C11",
        bi("Mongolian Pork", "蒙古猪"),
        `${SPICY} ${COMBO_INCLUDED}`,
        11,
        8,
        "combo",
      ),
      fixedItem(
        "combo-mongolian-beef",
        "C12",
        bi("Mongolian Beef", "蒙古牛"),
        `${SPICY} ${COMBO_INCLUDED}`,
        11,
        9,
        "combo",
      ),
      fixedItem(
        "combo-chicken-mixed-veg",
        "C13",
        bi("Chicken w/ Mixed Vegetables", "鸡杂菜"),
        COMBO_INCLUDED,
        11,
        10,
        "combo",
      ),
      fixedItem(
        "combo-beef-mixed-veg",
        "C14",
        bi("Beef w/ Mixed Vegetables", "牛杂菜"),
        COMBO_INCLUDED,
        11,
        11,
        "combo",
      ),
      fixedItem(
        "combo-shrimp-broccoli",
        "C15",
        bi("Shrimp w/ Broccoli", "虾西兰花"),
        COMBO_INCLUDED,
        11,
        12,
        "combo",
      ),
      fixedItem(
        "combo-buddhist-delight",
        "C16",
        bi("Buddhist Delight", "罗汉斋"),
        COMBO_INCLUDED,
        11,
        13,
        "combo",
      ),
    ],
  },
  {
    id: "appetizers-sides",
    name: CATEGORY_NAMES.appetizersSides,
    sortOrder: 2,
    items: [
      fixedItem("egg-roll", "A1", bi("Egg Roll", "春卷"), "", 2, 0),
      fixedItem("cheese-wonton", "A2", bi("Cheese Wonton (6)", "芝士云吞（6只）"), "", 5.5, 1),
      fixedItem("fried-shrimp", "A3", bi("Fried Shrimp (10)", "炸虾（10只）"), "", 10, 2),
      fixedItem("app-chicken-on-stick", "A4", bi("Chicken on Stick (5)", "串鸡（5串）"), "", 7, 3),
      fixedItem(
        "app-chicken-wings",
        "A5",
        bi("Chicken Wings (6)", "鸡翅（6只）"),
        "",
        7.5,
        4,
        false,
        true,
      ),
      fixedItem("sweet-donuts", "A6", bi("Sweet Donuts (10)", "甜圈（10个）"), "", 5, 5),
      fixedItem("steam-dumplings", "A7", bi("Steam Dumplings (10)", "水饺（10只）"), "", 9, 6),
      fixedItem("fried-dumplings", "A8", bi("Fried Dumplings (10)", "锅贴（10只）"), "", 9, 7),
      fixedItem("steam-rice", null, bi("Steam Rice", "白饭"), "", 3, 8),
      fixedItem("soy-duck-packet", null, bi("Soy & Duck Packet", "酱油鸭酱包"), "", 0.1, 9),
      fixedItem("hot-sauce-side", null, bi("Hot Sauce", "辣酱"), "", 1, 10),
      fixedItem("fried-rice-side", null, bi("Fried Rice", "炒饭"), "", 3.5, 11),
      fixedItem("crispy-noodles", null, bi("Crispy Noodles", "脆面"), "", 1.5, 12),
      sizedItem("yum-yum-sauce", null, bi("Yum Yum Sauce", "Yum Yum酱"), "", 1, 2, 13),
      sizedItem(
        "red-sweet-sour-sauce",
        null,
        bi("Red Sweet & Sour Sauce", "红酸甜酱"),
        "",
        1,
        2,
        14,
      ),
      sizedItem(
        "brown-sweet-sour-sauce",
        null,
        bi("Brown Sweet & Sour Sauce", "褐酸甜酱"),
        "",
        1,
        2,
        15,
      ),
    ],
  },
  {
    id: "soups",
    name: CATEGORY_NAMES.soups,
    sortOrder: 3,
    items: [
      sizedItem("egg-drop-soup", "S7", bi("Egg Drop Soup", "蛋花汤"), "", 4, 7, 0, "ingredients"),
      sizedItem(
        "spicy-sour-soup",
        "S8",
        bi("Spicy Sour Soup", "酸辣汤"),
        SPICY,
        4,
        7,
        1,
        "ingredients",
      ),
      sizedItem(
        "vegetable-soup",
        "s9",
        bi("Vegetable Soup", "菜汤"),
        "",
        4,
        7,
        2,
        "ingredients",
      ),
    ],
  },
  {
    id: "fried-rice",
    name: CATEGORY_NAMES.friedRice,
    sortOrder: 4,
    items: [
      sizedItem(
        "veg-fried-rice",
        "11",
        bi("Vegetable Fried Rice", "菜炒饭"),
        MENU_COPY.friedRiceBase,
        6,
        9,
        0,
        "ingredients",
      ),
      sizedItem(
        "pork-fried-rice",
        "12",
        bi("Pork Fried Rice", "猪炒饭"),
        MENU_COPY.friedRiceBase,
        7.5,
        10,
        1,
        "ingredients",
      ),
      sizedItem(
        "chicken-fried-rice",
        "13",
        bi("Chicken Fried Rice", "鸡炒饭"),
        MENU_COPY.friedRiceBase,
        7.5,
        10,
        2,
        "ingredients",
      ),
      sizedItem(
        "ham-fried-rice",
        "14",
        bi("Ham Fried Rice", "火腿炒饭"),
        MENU_COPY.friedRiceBase,
        7.5,
        10,
        3,
        "ingredients",
      ),
      sizedItem(
        "beef-fried-rice",
        "15",
        bi("Beef Fried Rice", "牛炒饭"),
        MENU_COPY.friedRiceBase,
        8,
        11,
        4,
        "ingredients",
      ),
      sizedItem(
        "shrimp-fried-rice",
        "16",
        bi("Shrimp Fried Rice", "虾炒饭"),
        MENU_COPY.friedRiceBase,
        7.5,
        10,
        5,
        "ingredients",
      ),
      sizedItem(
        "house-fried-rice",
        "17",
        bi("House Fried Rice", "本楼炒饭"),
        MENU_COPY.friedRiceBase,
        8,
        11,
        6,
        "ingredients",
      ),
    ],
  },
  {
    id: "lo-mein",
    name: CATEGORY_NAMES.loMein,
    sortOrder: 5,
    items: [
      sizedItem(
        "veg-lo-mein",
        "21",
        bi("Vegetable Lo Mein", "菜捞面"),
        MENU_COPY.loMeinBase,
        7.5,
        10,
        0,
        "ingredients",
      ),
      sizedItem(
        "pork-lo-mein",
        "22",
        bi("Pork Lo Mein", "猪捞面"),
        MENU_COPY.loMeinBase,
        7.5,
        10,
        1,
        "ingredients",
      ),
      sizedItem(
        "chicken-lo-mein",
        "23",
        bi("Chicken Lo Mein", "鸡捞面"),
        MENU_COPY.loMeinBase,
        7.5,
        10,
        2,
        "ingredients",
      ),
      sizedItem(
        "ham-lo-mein",
        "24",
        bi("Ham Lo Mein", "火腿捞面"),
        MENU_COPY.loMeinBase,
        7.5,
        10,
        3,
        "ingredients",
      ),
      sizedItem(
        "beef-lo-mein",
        "25",
        bi("Beef Lo Mein", "牛捞面"),
        MENU_COPY.loMeinBase,
        8,
        11,
        4,
        "ingredients",
      ),
      sizedItem(
        "shrimp-lo-mein",
        "26",
        bi("Shrimp Lo Mein", "虾捞面"),
        MENU_COPY.loMeinBase,
        7.5,
        10,
        5,
        "ingredients",
      ),
      sizedItem(
        "house-lo-mein",
        "27",
        bi("House Lo Mein", "本楼捞面"),
        MENU_COPY.loMeinBase,
        8,
        11,
        6,
        "ingredients",
      ),
    ],
  },
  {
    id: "vegetable",
    name: CATEGORY_NAMES.vegetable,
    sortOrder: 6,
    items: [
      fixedItem(
        "buddhist-delight",
        "31",
        bi("Buddhist Delight", "罗汉斋"),
        WITH_RICE,
        10,
        0,
        "with-rice",
      ),
      fixedItem(
        "mixed-vegetable",
        "32",
        bi("Mixed Vegetable", "杂菜"),
        WITH_RICE,
        10,
        1,
        "with-rice",
      ),
    ],
  },
  {
    id: "chicken",
    name: CATEGORY_NAMES.chicken,
    sortOrder: 7,
    items: [
      sizedItem(
        "moo-goo-gai-pan",
        "40",
        bi("Moo Goo Gai Pan", "蘑菇鸡片"),
        WITH_RICE,
        8,
        11,
        0,
        "with-rice",
      ),
      sizedItem(
        "general-tsos-chicken",
        "41",
        bi("General Tso's Chicken", "左宗鸡"),
        `${SPICY} ${WITH_RICE}`,
        8,
        12,
        1,
        "with-rice",
      ),
      sizedItem(
        "chicken-broccoli",
        "42",
        bi("Chicken w/ Broccoli", "鸡西兰花"),
        WITH_RICE,
        8,
        11,
        2,
        "with-rice",
      ),
      sizedItem(
        "chicken-vegetable",
        "43",
        bi("Chicken w/ Vegetable", "鸡杂菜"),
        WITH_RICE,
        8,
        11,
        3,
        "with-rice",
      ),
      sizedItem(
        "black-pepper-chicken",
        "44",
        bi("Black Pepper Chicken", "黑椒鸡"),
        `${SPICY} ${WITH_RICE}`,
        8,
        11,
        4,
        "with-rice",
      ),
      sizedItem(
        "sweet-sour-chicken",
        "45",
        bi("Sweet & Sour Chicken", "甜酸鸡"),
        WITH_RICE,
        8,
        12,
        5,
        "with-rice",
      ),
      sizedItem(
        "sesame-chicken",
        "46",
        bi("Sesame Chicken", "芝麻鸡"),
        WITH_RICE,
        8,
        12,
        6,
        "with-rice",
      ),
      sizedItem(
        "kung-pao-chicken",
        "47",
        bi("Kung Pao Chicken", "宫保鸡"),
        `${SPICY} ${WITH_RICE}`,
        8,
        11,
        7,
        "with-rice",
      ),
    ],
  },
  {
    id: "pork",
    name: CATEGORY_NAMES.pork,
    sortOrder: 8,
    items: [
      sizedItem(
        "pork-broccoli",
        "51",
        bi("Pork w/ Broccoli", "猪西兰花"),
        WITH_RICE,
        8,
        11,
        0,
        "with-rice",
      ),
      sizedItem(
        "pork-vegetable",
        "52",
        bi("Pork w/ Vegetable", "猪杂菜"),
        WITH_RICE,
        8,
        11,
        1,
        "with-rice",
      ),
      sizedItem(
        "mongolian-pork",
        "53",
        bi("Mongolian Pork", "蒙古猪"),
        `${SPICY} ${WITH_RICE}`,
        8,
        11,
        2,
        "with-rice",
      ),
      sizedItem(
        "hunan-pork",
        "54",
        bi("Hunan Pork", "湖南猪"),
        `${SPICY} ${WITH_RICE}`,
        8,
        11,
        3,
        "with-rice",
      ),
      sizedItem(
        "yu-sheng-pork",
        "55",
        bi("Yu Sheng Pork", "鱼香猪"),
        `${SPICY} ${WITH_RICE}`,
        8,
        11,
        4,
        "with-rice",
      ),
    ],
  },
  {
    id: "beef",
    name: CATEGORY_NAMES.beef,
    sortOrder: 9,
    items: [
      sizedItem(
        "pepper-steak",
        "61",
        bi("Pepper Steak", "胡椒牛"),
        WITH_RICE,
        9,
        13,
        0,
        "with-rice",
      ),
      sizedItem(
        "beef-broccoli",
        "62",
        bi("Beef w/ Broccoli", "牛西兰花"),
        WITH_RICE,
        9,
        13,
        1,
        "with-rice",
      ),
      sizedItem(
        "beef-vegetable",
        "63",
        bi("Beef w/ Vegetable", "牛杂菜"),
        WITH_RICE,
        9,
        13,
        2,
        "with-rice",
      ),
      sizedItem(
        "mongolian-beef",
        "64",
        bi("Mongolian Beef", "蒙古牛"),
        `${SPICY} ${WITH_RICE}`,
        9,
        13,
        3,
        "with-rice",
      ),
      sizedItem(
        "hunan-beef",
        "65",
        bi("Hunan Beef", "湖南牛"),
        `${SPICY} ${WITH_RICE}`,
        9,
        13,
        4,
        "with-rice",
      ),
      sizedItem(
        "kung-pao-beef",
        "66",
        bi("Kung Pao Beef", "宫保牛"),
        `${SPICY} ${WITH_RICE}`,
        9,
        13,
        5,
        "with-rice",
      ),
    ],
  },
  {
    id: "shrimp",
    name: CATEGORY_NAMES.shrimp,
    sortOrder: 10,
    items: [
      sizedItem(
        "shrimp-lobster-sauce",
        "71",
        bi("Shrimp in Lobster Sauce", "虾龙须酱"),
        WITH_RICE,
        9,
        12,
        0,
        "with-rice",
      ),
      sizedItem(
        "shrimp-broccoli",
        "72",
        bi("Shrimp w/ Broccoli", "虾西兰花"),
        WITH_RICE,
        9,
        12,
        1,
        "with-rice",
      ),
      sizedItem(
        "shrimp-vegetable",
        "73",
        bi("Shrimp w/ Vegetable", "虾杂菜"),
        WITH_RICE,
        9,
        12,
        2,
        "with-rice",
      ),
      sizedItem(
        "yu-sheng-shrimp",
        "74",
        bi("Yu Sheng Shrimp", "鱼香虾"),
        `${SPICY} ${WITH_RICE}`,
        9,
        12,
        3,
        "with-rice",
      ),
      sizedItem(
        "sweet-sour-shrimp",
        "75",
        bi("Sweet & Sour Shrimp", "甜酸虾"),
        WITH_RICE,
        9,
        12,
        4,
        "with-rice",
      ),
    ],
  },
  {
    id: "drinks",
    name: CATEGORY_NAMES.drinks,
    sortOrder: 11,
    items: [
      fixedItem("water", null, bi("Water", "水"), "", 1, 0),
      fixedItem("soda", null, bi("Soda", "汽水"), "", 2, 1),
      fixedItem("sweet-tea", null, bi("Sweet Tea", "甜茶"), "", 2.5, 2),
    ],
  },
];
