export type SeedModifier = {
  id: string;
  name: string;
  priceDelta: number;
  sortOrder: number;
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
  "Egg",
  "Onion",
  "Broccoli",
  "Carrot",
  "Peas",
  "Celery",
  "Mixed Vegetables",
  "Shrimp",
  "Chicken",
  "Beef",
  "Pork",
  "Ham",
  "Napa",
  "Sauce",
  "Brown Sauce",
  "Sweet & Sour Sauce",
  "Hot Sauce",
  "Spicy",
  "Noodles",
] as const;

const PROTEIN_EXTRA_PRICE = 3.5;
const BEEF_EXTRA_PRICE = 4;
const BROCCOLI_EXTRA_PRICE = 3.5;
const SAUCE_EXTRA_PRICE = 1;
const DEFAULT_EXTRA_PRICE = 1.5;

const FRIED_RICE_SWAPS = [
  { name: "Vegetable Fried Rice", price: 3.5, key: "veg" },
  { name: "Pork Fried Rice", price: 3.5, key: "pork" },
  { name: "Chicken Fried Rice", price: 3.5, key: "chicken" },
  { name: "Ham Fried Rice", price: 3.5, key: "ham" },
  { name: "Shrimp Fried Rice", price: 3.5, key: "shrimp" },
  { name: "House Fried Rice", price: 3.5, key: "house" },
  { name: "Beef Fried Rice", price: 4, key: "beef" },
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
        name: `Extra ${ingredient}`,
        priceDelta: extraPrice(ingredient),
        sortOrder: sortOrder++,
      },
      {
        id: `${itemId}-no-${key}`,
        name: `No ${ingredient}`,
        priceDelta: 0,
        sortOrder: sortOrder++,
      },
    );
  }

  return options;
}

function riceSideOptions(itemId: string, mode: "with-rice" | "combo"): SeedModifier[] {
  const options: SeedModifier[] = [];
  let sortOrder = 0;

  options.push({
    id: `${itemId}-rice-none`,
    name: "No Rice",
    priceDelta: 0,
    sortOrder: sortOrder++,
  });

  if (mode === "with-rice") {
    options.push(
      { id: `${itemId}-rice-steam`, name: "Steam Rice", priceDelta: 0, sortOrder: sortOrder++ },
      { id: `${itemId}-rice-fried`, name: "Fried Rice", priceDelta: 0, sortOrder: sortOrder++ },
    );
  }

  for (const swap of FRIED_RICE_SWAPS) {
    if (mode === "combo" && swap.key === "ham") continue;

    options.push({
      id: `${itemId}-rice-${swap.key}`,
      name: swap.name,
      priceDelta: swap.price,
      sortOrder: sortOrder++,
    });
  }

  return options;
}

function buildOptions(itemId: string, mode: CustomizationMode): SeedModifier[] | undefined {
  if (!mode) return undefined;

  if (mode === "ingredients") {
    return ingredientOptions(itemId, 0);
  }

  const riceOptions = riceSideOptions(itemId, mode);
  const ingredientStart = riceOptions.length;
  return [...riceOptions, ...ingredientOptions(itemId, ingredientStart)];
}

function smallLargeSizes(itemId: string, small: number, large: number): SeedModifier[] {
  return [
    { id: `${itemId}-small`, name: "Small", priceDelta: small, sortOrder: 0 },
    { id: `${itemId}-large`, name: "Large", priceDelta: large, sortOrder: 1 },
  ];
}

function fixedItem(
  id: string,
  itemNumber: string | null,
  name: string,
  description: string,
  price: number,
  sortOrder: number,
  customization: CustomizationMode = false,
): SeedItem {
  return {
    id,
    itemNumber,
    name,
    description,
    price,
    sortOrder,
    options: buildOptions(id, customization),
  };
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

const WITH_RICE = "Served with steamed or fried rice.";
const COMBO_INCLUDED = "Served with ham fried rice and egg roll.";
const SPICY = "Hot & spicy.";

export const Menu: SeedCategory[] = [
  {
    id: "chefs-specialties",
    name: "Chef's Specialties",
    sortOrder: 0,
    items: [
      fixedItem(
        "happy-family",
        "1",
        "Happy Family",
        `Shrimp, beef, chicken, pork, and vegetables stir fried in brown sauce. ${WITH_RICE}`,
        15,
        0,
        "with-rice",
      ),
      fixedItem(
        "triple-delight",
        "3",
        "Triple Delight",
        `Shrimp, beef, and chicken stir fried in brown sauce. ${WITH_RICE}`,
        15,
        1,
        "with-rice",
      ),
      fixedItem(
        "orange-chicken",
        "4",
        "Orange Chicken",
        `${SPICY} ${WITH_RICE}`,
        13,
        2,
        "with-rice",
      ),
      fixedItem(
        "chow-mein",
        "5",
        "Chow Mein",
        `Chicken, pork, beef, shrimp, and vegetables with crispy noodles. ${WITH_RICE}`,
        11,
        3,
        "with-rice",
      ),
      fixedItem(
        "chop-suey",
        "6",
        "Chop Suey",
        `Chicken, pork, beef, shrimp, and vegetables. ${WITH_RICE}`,
        11,
        4,
        "with-rice",
      ),
      {
        id: "egg-foo-young",
        itemNumber: "7",
        name: "Egg Foo Young",
        description: "Choose style — shown on kitchen ticket.",
        price: 0,
        sortOrder: 5,
        sizes: [
          { id: "egg-foo-young-chicken", name: "Chicken EFY", priceDelta: 11, sortOrder: 0 },
          { id: "egg-foo-young-pork", name: "Pork EFY", priceDelta: 11, sortOrder: 1 },
          { id: "egg-foo-young-vegetable", name: "Vegetable EFY", priceDelta: 11, sortOrder: 2 },
          { id: "egg-foo-young-beef", name: "Beef EFY", priceDelta: 12, sortOrder: 3 },
          { id: "egg-foo-young-shrimp", name: "Shrimp EFY", priceDelta: 12, sortOrder: 4 },
          { id: "egg-foo-young-house", name: "House EFY", priceDelta: 12, sortOrder: 5 },
        ],
        options: buildOptions("egg-foo-young", "ingredients"),
      },
    ],
  },
  {
    id: "special-combo",
    name: "Special Combo",
    sortOrder: 1,
    items: [
      fixedItem("combo-chicken-on-stick", "C1", "Chicken on Stick", COMBO_INCLUDED, 11, 0, "combo"),
      fixedItem("combo-chicken-wings", "C2", "Chicken Wings", COMBO_INCLUDED, 11, 1, "combo"),
      fixedItem(
        "combo-general-tsos",
        "C3",
        "General Tso's Chicken",
        `${SPICY} ${COMBO_INCLUDED}`,
        11,
        2,
        "combo",
      ),
      fixedItem("combo-sweet-sour-chicken", "C4", "Sweet & Sour Chicken", COMBO_INCLUDED, 11, 3, "combo"),
      fixedItem("combo-chicken-broccoli", "C5", "Chicken w/ Broccoli", COMBO_INCLUDED, 11, 4, "combo"),
      fixedItem("combo-sesame-chicken", "C6", "Sesame Chicken", COMBO_INCLUDED, 11, 5, "combo"),
      fixedItem("combo-beef-broccoli", "C9", "Beef w/ Broccoli", COMBO_INCLUDED, 11, 6, "combo"),
      fixedItem("combo-pepper-steak", "C10", "Pepper Steak", COMBO_INCLUDED, 11, 7, "combo"),
      fixedItem(
        "combo-mongolian-pork",
        "C11",
        "Mongolian Pork",
        `${SPICY} ${COMBO_INCLUDED}`,
        11,
        8,
        "combo",
      ),
      fixedItem(
        "combo-mongolian-beef",
        "C12",
        "Mongolian Beef",
        `${SPICY} ${COMBO_INCLUDED}`,
        11,
        9,
        "combo",
      ),
      fixedItem(
        "combo-chicken-mixed-veg",
        "C13",
        "Chicken w/ Mixed Vegetables",
        COMBO_INCLUDED,
        11,
        10,
        "combo",
      ),
      fixedItem(
        "combo-beef-mixed-veg",
        "C14",
        "Beef w/ Mixed Vegetables",
        COMBO_INCLUDED,
        11,
        11,
        "combo",
      ),
      fixedItem("combo-shrimp-broccoli", "C15", "Shrimp w/ Broccoli", COMBO_INCLUDED, 11, 12, "combo"),
      fixedItem("combo-buddhist-delight", "C16", "Buddhist Delight", COMBO_INCLUDED, 11, 13, "combo"),
    ],
  },
  {
    id: "appetizers-sides",
    name: "Appetizers & Sides",
    sortOrder: 2,
    items: [
      fixedItem("egg-roll", "A1", "Egg Roll", "", 2, 0),
      fixedItem("cheese-wonton", "A2", "Cheese Wonton (6)", "", 5.5, 1),
      fixedItem("fried-shrimp", "A3", "Fried Shrimp (10)", "", 10, 2),
      fixedItem("app-chicken-on-stick", "A4", "Chicken on Stick (5)", "", 7, 3),
      fixedItem("app-chicken-wings", "A5", "Chicken Wings (5)", "", 7.5, 4),
      fixedItem("sweet-donuts", "A6", "Sweet Donuts (10)", "", 5, 5),
      fixedItem("steam-dumplings", "A7", "Steam Dumplings (10)", "", 9, 6),
      fixedItem("fried-dumplings", "A8", "Fried Dumplings (10)", "", 9, 7),
      fixedItem("steam-rice", null, "Steam Rice", "", 3, 8),
      fixedItem("soy-duck-packet", null, "Soy & Duck Packet", "", 0.1, 9),
      fixedItem("hot-sauce-side", null, "Hot Sauce", "", 1, 10),
      fixedItem("fried-rice-side", null, "Fried Rice", "", 3.5, 11),
      fixedItem("crispy-noodles", null, "Crispy Noodles", "", 1.5, 12),
      fixedItem("yum-yum-sauce", null, "Yum Yum Sauce", "", 2, 13),
      fixedItem("red-sweet-sour-sauce", null, "Red Sweet & Sour Sauce", "", 2, 14),
      fixedItem("brown-sweet-sour-sauce", null, "Brown Sweet & Sour Sauce", "", 2, 15),
    ],
  },
  {
    id: "soups",
    name: "Soups",
    sortOrder: 3,
    items: [
      sizedItem("egg-drop-soup", "S7", "Egg Drop Soup", "", 4, 7, 0, "ingredients"),
      sizedItem("spicy-sour-soup", "S8", "Spicy Sour Soup", SPICY, 4, 7, 1, "ingredients"),
      sizedItem("vegetable-soup", "s9", "Vegetable Soup", "", 4, 7, 2, "ingredients"),
    ],
  },
  {
    id: "fried-rice",
    name: "Fried Rice",
    sortOrder: 4,
    items: [
      sizedItem(
        "veg-fried-rice",
        "11",
        "Vegetable Fried Rice",
        "Cooked with pea, carrot, onion, and egg.",
        6,
        9,
        0,
        "ingredients",
      ),
      sizedItem(
        "pork-fried-rice",
        "12",
        "Pork Fried Rice",
        "Cooked with pea, carrot, onion, and egg.",
        7.5,
        10,
        1,
        "ingredients",
      ),
      sizedItem(
        "chicken-fried-rice",
        "13",
        "Chicken Fried Rice",
        "Cooked with pea, carrot, onion, and egg.",
        7.5,
        10,
        2,
        "ingredients",
      ),
      sizedItem(
        "ham-fried-rice",
        "14",
        "Ham Fried Rice",
        "Cooked with pea, carrot, onion, and egg.",
        7.5,
        10,
        3,
        "ingredients",
      ),
      sizedItem(
        "beef-fried-rice",
        "15",
        "Beef Fried Rice",
        "Cooked with pea, carrot, onion, and egg.",
        8,
        11,
        4,
        "ingredients",
      ),
      sizedItem(
        "shrimp-fried-rice",
        "16",
        "Shrimp Fried Rice",
        "Cooked with pea, carrot, onion, and egg.",
        7.5,
        10,
        5,
        "ingredients",
      ),
      sizedItem(
        "house-fried-rice",
        "17",
        "House Fried Rice",
        "Cooked with pea, carrot, onion, and egg.",
        8,
        11,
        6,
        "ingredients",
      ),
    ],
  },
  {
    id: "lo-mein",
    name: "Lo Mein",
    sortOrder: 5,
    items: [
      sizedItem(
        "veg-lo-mein",
        "21",
        "Vegetable Lo Mein",
        "Spaghetti-like noodles with carrot, celery, onion, and napa.",
        7.5,
        10,
        0,
        "ingredients",
      ),
      sizedItem(
        "pork-lo-mein",
        "22",
        "Pork Lo Mein",
        "Spaghetti-like noodles with carrot, celery, onion, and napa.",
        7.5,
        10,
        1,
        "ingredients",
      ),
      sizedItem(
        "chicken-lo-mein",
        "23",
        "Chicken Lo Mein",
        "Spaghetti-like noodles with carrot, celery, onion, and napa.",
        7.5,
        10,
        2,
        "ingredients",
      ),
      sizedItem(
        "ham-lo-mein",
        "24",
        "Ham Lo Mein",
        "Spaghetti-like noodles with carrot, celery, onion, and napa.",
        7.5,
        10,
        3,
        "ingredients",
      ),
      sizedItem(
        "beef-lo-mein",
        "25",
        "Beef Lo Mein",
        "Spaghetti-like noodles with carrot, celery, onion, and napa.",
        8,
        11,
        4,
        "ingredients",
      ),
      sizedItem(
        "shrimp-lo-mein",
        "26",
        "Shrimp Lo Mein",
        "Spaghetti-like noodles with carrot, celery, onion, and napa.",
        7.5,
        10,
        5,
        "ingredients",
      ),
      sizedItem(
        "house-lo-mein",
        "27",
        "House Lo Mein",
        "Spaghetti-like noodles with carrot, celery, onion, and napa.",
        8,
        11,
        6,
        "ingredients",
      ),
    ],
  },
  {
    id: "vegetable",
    name: "Vegetable",
    sortOrder: 6,
    items: [
      fixedItem("buddhist-delight", "31", "Buddhist Delight", WITH_RICE, 10, 0, "with-rice"),
      fixedItem("mixed-vegetable", "32", "Mixed Vegetable", WITH_RICE, 10, 1, "with-rice"),
    ],
  },
  {
    id: "chicken",
    name: "Chicken",
    sortOrder: 7,
    items: [
      sizedItem("moo-goo-gai-pan", "40", "Moo Goo Gai Pan", WITH_RICE, 8, 11, 0, "with-rice"),
      sizedItem("general-tsos-chicken", "41", "General Tso's Chicken", `${SPICY} ${WITH_RICE}`, 8, 12, 1, "with-rice"),
      sizedItem("chicken-broccoli", "42", "Chicken w/ Broccoli", WITH_RICE, 8, 11, 2, "with-rice"),
      sizedItem("chicken-vegetable", "43", "Chicken w/ Vegetable", WITH_RICE, 8, 11, 3, "with-rice"),
      sizedItem("black-pepper-chicken", "44", "Black Pepper Chicken", `${SPICY} ${WITH_RICE}`, 8, 11, 4, "with-rice"),
      sizedItem("sweet-sour-chicken", "45", "Sweet & Sour Chicken", WITH_RICE, 8, 12, 5, "with-rice"),
      sizedItem("sesame-chicken", "46", "Sesame Chicken", WITH_RICE, 8, 12, 6, "with-rice"),
      sizedItem("kung-pao-chicken", "47", "Kung Pao Chicken", `${SPICY} ${WITH_RICE}`, 8, 11, 7, "with-rice"),
    ],
  },
  {
    id: "pork",
    name: "Pork",
    sortOrder: 8,
    items: [
      sizedItem("pork-broccoli", "51", "Pork w/ Broccoli", WITH_RICE, 8, 11, 0, "with-rice"),
      sizedItem("pork-vegetable", "52", "Pork w/ Vegetable", WITH_RICE, 8, 11, 1, "with-rice"),
      sizedItem("mongolian-pork", "53", "Mongolian Pork", `${SPICY} ${WITH_RICE}`, 8, 11, 2, "with-rice"),
      sizedItem("hunan-pork", "54", "Hunan Pork", `${SPICY} ${WITH_RICE}`, 8, 11, 3, "with-rice"),
      sizedItem("yu-sheng-pork", "55", "Yu Sheng Pork", `${SPICY} ${WITH_RICE}`, 8, 11, 4, "with-rice"),
    ],
  },
  {
    id: "beef",
    name: "Beef",
    sortOrder: 9,
    items: [
      sizedItem("pepper-steak", "61", "Pepper Steak", WITH_RICE, 9, 13, 0, "with-rice"),
      sizedItem("beef-broccoli", "62", "Beef w/ Broccoli", WITH_RICE, 9, 13, 1, "with-rice"),
      sizedItem("beef-vegetable", "63", "Beef w/ Vegetable", WITH_RICE, 9, 13, 2, "with-rice"),
      sizedItem("mongolian-beef", "64", "Mongolian Beef", `${SPICY} ${WITH_RICE}`, 9, 13, 3, "with-rice"),
      sizedItem("hunan-beef", "65", "Hunan Beef", `${SPICY} ${WITH_RICE}`, 9, 13, 4, "with-rice"),
      sizedItem("kung-pao-beef", "66", "Kung Pao Beef", `${SPICY} ${WITH_RICE}`, 9, 13, 5, "with-rice"),
    ],
  },
  {
    id: "shrimp",
    name: "Shrimp",
    sortOrder: 10,
    items: [
      sizedItem("shrimp-lobster-sauce", "71", "Shrimp in Lobster Sauce", WITH_RICE, 9, 12, 0, "with-rice"),
      sizedItem("shrimp-broccoli", "72", "Shrimp w/ Broccoli", WITH_RICE, 9, 12, 1, "with-rice"),
      sizedItem("shrimp-vegetable", "73", "Shrimp w/ Vegetable", WITH_RICE, 9, 12, 2, "with-rice"),
      sizedItem("yu-sheng-shrimp", "74", "Yu Sheng Shrimp", `${SPICY} ${WITH_RICE}`, 9, 12, 3, "with-rice"),
      sizedItem("sweet-sour-shrimp", "75", "Sweet & Sour Shrimp", WITH_RICE, 9, 12, 4, "with-rice"),
    ],
  },
];
