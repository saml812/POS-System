import { appError } from "../lib/appError.js";
import { prisma } from "../lib/db.js";
import { parseLocale, parseOptionalText } from "../lib/menuLocale.js";
import { translateTexts } from "../lib/translate.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

// Returns the translated text from the map, falling back to the original.
// `translations` is null when serving English (no translation requested).
function localize(text, translations) {
  if (!text || !translations) {
    return text ?? null;
  }
  return translations.get(text.trim()) ?? text;
}

function toCategory(category, translations = null) {
  const { id, name, sortOrder, isActive, createdAt, updatedAt } = category;
  return {
    id,
    name: localize(name, translations),
    sortOrder,
    isActive,
    createdAt,
    updatedAt,
  };
}

function toMenuItemOption(option, translations = null) {
  const { id, menuItemId, name, priceDelta, sortOrder, isAvailable, createdAt, updatedAt } =
    option;
  return {
    id,
    menuItemId,
    name: localize(name, translations),
    priceDelta: Number(priceDelta),
    sortOrder,
    isAvailable,
    createdAt,
    updatedAt,
  };
}

function toMenuItem(item, translations = null) {
  const {
    id,
    itemNumber,
    name,
    description,
    price,
    sortOrder,
    isAvailable,
    categoryId,
    createdAt,
    updatedAt,
    options,
  } = item;
  const result = {
    id,
    itemNumber: itemNumber ?? null,
    name: localize(name, translations),
    description: localize(description, translations),
    price: Number(price),
    sortOrder,
    isAvailable,
    categoryId,
    createdAt,
    updatedAt,
  };

  if (options) {
    result.options = options.map((option) =>
      toMenuItemOption(option, translations),
    );
  }

  return result;
}

function parseSortOrder(value, fallback = 0) {
  if (value === undefined || value === null) {
    return fallback;
  }

  const sortOrder = Number(value);
  if (!Number.isInteger(sortOrder)) {
    throw appError("sortOrder must be an integer");
  }

  return sortOrder;
}

function parsePrice(value) {
  const price = Number(value);
  if (Number.isNaN(price) || price < 0) {
    throw appError("price must be a non-negative number");
  }

  return Math.round(price * 100) / 100;
}

function parseRequiredName(name) {
  const trimmed = name?.trim();
  if (!trimmed) {
    throw appError("name is required");
  }

  return trimmed;
}

function parseItemNumber(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length > 12) {
    throw appError("itemNumber must be 12 characters or fewer");
  }

  if (!/^([A-Za-z][0-9]+|[0-9]+)$/.test(trimmed)) {
    throw appError("itemNumber must be like A1, C2, or 11");
  }

  const letterMatch = trimmed.match(/^([A-Za-z])([0-9]+)$/);
  if (letterMatch) {
    return `${letterMatch[1].toUpperCase()}${letterMatch[2]}`;
  }

  return trimmed;
}

const categoryOrder = [{ sortOrder: "asc" }, { name: "asc" }];
const itemOrder = [{ sortOrder: "asc" }, { name: "asc" }];
const optionOrder = [{ sortOrder: "asc" }, { name: "asc" }];
const itemInclude = {
  options: {
    orderBy: optionOrder,
  },
};

const publicItemInclude = {
  options: {
    where: { isAvailable: true },
    orderBy: optionOrder,
  },
};

/**
 * Builds a Map<sourceText, translatedText> covering every name/description in
 * the menu tree, using the translation API (results are cached in memory).
 * Returns an empty map when translation is disabled or fails, so callers fall
 * back to the original English text.
 */
async function buildMenuTranslations(categories) {
  const texts = [];
  for (const category of categories) {
    texts.push(category.name);
    for (const item of category.items ?? []) {
      texts.push(item.name);
      if (item.description) {
        texts.push(item.description);
      }
      for (const option of item.options ?? []) {
        texts.push(option.name);
      }
    }
  }

  return translateTexts(texts);
}

export const getMenu = asyncHandler(async (req, res) => {
  const locale = parseLocale(req.query.locale);
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: categoryOrder,
    include: {
      items: {
        where: { isAvailable: true },
        orderBy: itemOrder,
        include: publicItemInclude,
      },
    },
  });

  let translations = null;
  if (locale === "zh") {
    try {
      translations = await buildMenuTranslations(categories);
    } catch (translationError) {
      console.error("Menu translation failed:", translationError);
      translations = null;
    }
  }

  res.json({
    categories: categories.map((category) => ({
      ...toCategory(category, translations),
      items: category.items.map((item) => toMenuItem(item, translations)),
    })),
  });
});

export const getMenuAdmin = asyncHandler(async (req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: categoryOrder,
    include: {
      items: {
        orderBy: itemOrder,
        include: itemInclude,
      },
    },
  });

  res.json({
    categories: categories.map((category) => toCategory(category)),
    items: categories.flatMap((category) =>
      category.items.map((item) => toMenuItem(item)),
    ),
  });
});

export const createCategory = asyncHandler(async (req, res) => {
  const category = await prisma.category.create({
    data: {
      name: parseRequiredName(req.body.name),
      sortOrder: parseSortOrder(req.body.sortOrder),
      isActive: req.body.isActive ?? true,
    },
  });

  res.status(201).json({ category: toCategory(category) });
});

export const updateCategory = asyncHandler(async (req, res) => {
  const data = {};

  if (req.body.name !== undefined) {
    data.name = parseRequiredName(req.body.name);
  }

  if (req.body.sortOrder !== undefined) {
    data.sortOrder = parseSortOrder(req.body.sortOrder);
  }

  if (req.body.isActive !== undefined) {
    data.isActive = Boolean(req.body.isActive);
  }

  if (Object.keys(data).length === 0) {
    throw appError("No valid fields to update");
  }

  const category = await prisma.category.update({
    where: { id: req.params.id },
    data,
  });

  res.json({ category: toCategory(category) });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  await prisma.category.delete({ where: { id: req.params.id } });
  res.json({ message: "Category deleted successfully" });
});

export const createItem = asyncHandler(async (req, res) => {
  const categoryId = req.body.categoryId?.trim();
  if (!categoryId) {
    throw appError("categoryId is required");
  }

  const item = await prisma.menuItem.create({
    data: {
      name: parseRequiredName(req.body.name),
      itemNumber: parseItemNumber(req.body.itemNumber),
      description: parseOptionalText(req.body.description),
      price: parsePrice(req.body.price),
      sortOrder: parseSortOrder(req.body.sortOrder),
      isAvailable: req.body.isAvailable ?? true,
      categoryId,
    },
    include: itemInclude,
  });

  res.status(201).json({ item: toMenuItem(item) });
});

export const updateItem = asyncHandler(async (req, res) => {
  const data = {};

  if (req.body.name !== undefined) {
    data.name = parseRequiredName(req.body.name);
  }

  if (req.body.itemNumber !== undefined) {
    data.itemNumber = parseItemNumber(req.body.itemNumber);
  }

  if (req.body.description !== undefined) {
    data.description = parseOptionalText(req.body.description);
  }

  if (req.body.price !== undefined) {
    data.price = parsePrice(req.body.price);
  }

  if (req.body.sortOrder !== undefined) {
    data.sortOrder = parseSortOrder(req.body.sortOrder);
  }

  if (req.body.isAvailable !== undefined) {
    data.isAvailable = Boolean(req.body.isAvailable);
  }

  if (req.body.categoryId !== undefined) {
    const categoryId = req.body.categoryId?.trim();
    if (!categoryId) {
      throw appError("categoryId cannot be empty");
    }
    data.categoryId = categoryId;
  }

  if (Object.keys(data).length === 0) {
    throw appError("No valid fields to update");
  }

  const item = await prisma.menuItem.update({
    where: { id: req.params.id },
    data,
    include: itemInclude,
  });

  res.json({ item: toMenuItem(item) });
});

export const deleteItem = asyncHandler(async (req, res) => {
  await prisma.menuItem.delete({ where: { id: req.params.id } });
  res.json({ message: "Item deleted successfully" });
});

export const createItemOption = asyncHandler(async (req, res) => {
  const option = await prisma.menuItemOption.create({
    data: {
      menuItemId: req.params.itemId,
      name: parseRequiredName(req.body.name),
      priceDelta: parsePrice(req.body.priceDelta ?? 0),
      sortOrder: parseSortOrder(req.body.sortOrder),
      isAvailable: req.body.isAvailable ?? true,
    },
  });

  res.status(201).json({ option: toMenuItemOption(option) });
});

export const updateItemOption = asyncHandler(async (req, res) => {
  const data = {};

  if (req.body.name !== undefined) {
    data.name = parseRequiredName(req.body.name);
  }

  if (req.body.priceDelta !== undefined) {
    data.priceDelta = parsePrice(req.body.priceDelta);
  }

  if (req.body.sortOrder !== undefined) {
    data.sortOrder = parseSortOrder(req.body.sortOrder);
  }

  if (req.body.isAvailable !== undefined) {
    data.isAvailable = Boolean(req.body.isAvailable);
  }

  if (Object.keys(data).length === 0) {
    throw appError("No valid fields to update");
  }

  const option = await prisma.menuItemOption.update({
    where: { id: req.params.id },
    data,
  });

  res.json({ option: toMenuItemOption(option) });
});

export const deleteItemOption = asyncHandler(async (req, res) => {
  await prisma.menuItemOption.delete({ where: { id: req.params.id } });
  res.json({ message: "Option deleted successfully" });
});
