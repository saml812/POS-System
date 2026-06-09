import { appError } from "../lib/appError.js";
import { prisma } from "../lib/db.js";
import { parseOptionalText } from "../lib/menuLocale.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

function toCategory(category) {
  const { id, name, sortOrder, isActive, createdAt, updatedAt } = category;
  return {
    id,
    name,
    sortOrder,
    isActive,
    createdAt,
    updatedAt,
  };
}

function toMenuItemModifier(modifier) {
  const { id, menuItemId, name, priceDelta, sortOrder, isAvailable, createdAt, updatedAt } =
    modifier;
  return {
    id,
    menuItemId,
    name,
    priceDelta: Number(priceDelta),
    sortOrder,
    isAvailable,
    createdAt,
    updatedAt,
  };
}

function modifierCreateData(body, menuItemId) {
  return {
    menuItemId,
    name: parseRequiredName(body.name),
    priceDelta: parsePriceDelta(body.priceDelta ?? 0),
    sortOrder: parseSortOrder(body.sortOrder),
    isAvailable: body.isAvailable ?? true,
  };
}

function modifierUpdateData(body) {
  const data = {};

  if (body.name !== undefined) {
    data.name = parseRequiredName(body.name);
  }

  if (body.priceDelta !== undefined) {
    data.priceDelta = parsePriceDelta(body.priceDelta);
  }

  if (body.sortOrder !== undefined) {
    data.sortOrder = parseSortOrder(body.sortOrder);
  }

  if (body.isAvailable !== undefined) {
    data.isAvailable = Boolean(body.isAvailable);
  }

  if (Object.keys(data).length === 0) {
    throw appError("No valid fields to update");
  }

  return data;
}

function toMenuItem(item) {
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
    sizes,
  } = item;
  const result = {
    id,
    itemNumber: itemNumber ?? null,
    name,
    description: description ?? null,
    price: Number(price),
    sortOrder,
    isAvailable,
    categoryId,
    createdAt,
    updatedAt,
  };

  if (options) {
    result.options = options.map(toMenuItemModifier);
  }

  if (sizes) {
    result.sizes = sizes.map(toMenuItemModifier);
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

function parsePriceDelta(value) {
  const delta = Number(value);
  if (Number.isNaN(delta) || delta < 0) {
    throw appError("priceDelta must be a non-negative number");
  }

  return Math.round(delta * 100) / 100;
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
const sizeOrder = [{ sortOrder: "asc" }, { name: "asc" }];
const itemInclude = {
  options: {
    orderBy: optionOrder,
  },
  sizes: {
    orderBy: sizeOrder,
  },
};

const publicItemInclude = {
  options: {
    where: { isAvailable: true },
    orderBy: optionOrder,
  },
  sizes: {
    where: { isAvailable: true },
    orderBy: sizeOrder,
  },
};

export const getMenu = asyncHandler(async (req, res) => {
  const [categories, items] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: categoryOrder,
    }),
    prisma.menuItem.findMany({
      where: { isAvailable: true, category: { isActive: true } },
      orderBy: itemOrder,
      include: publicItemInclude,
      relationLoadStrategy: "join",
    }),
  ]);

  const itemsByCategory = new Map();
  for (const item of items) {
    const list = itemsByCategory.get(item.categoryId) ?? [];
    list.push(toMenuItem(item));
    itemsByCategory.set(item.categoryId, list);
  }

  res.json({
    categories: categories.map((category) => ({
      ...toCategory(category),
      items: itemsByCategory.get(category.id) ?? [],
    })),
  });
});

export const getMenuAdmin = asyncHandler(async (req, res) => {
  const [categories, items] = await Promise.all([
    prisma.category.findMany({ orderBy: categoryOrder }),
    prisma.menuItem.findMany({
      orderBy: itemOrder,
      include: itemInclude,
      relationLoadStrategy: "join",
    }),
  ]);

  res.json({
    categories: categories.map((category) => toCategory(category)),
    items: items.map((item) => toMenuItem(item)),
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
    data: modifierCreateData(req.body, req.params.itemId),
  });

  res.status(201).json({ option: toMenuItemModifier(option) });
});

export const updateItemOption = asyncHandler(async (req, res) => {
  const option = await prisma.menuItemOption.update({
    where: { id: req.params.id },
    data: modifierUpdateData(req.body),
  });

  res.json({ option: toMenuItemModifier(option) });
});

export const deleteItemOption = asyncHandler(async (req, res) => {
  await prisma.menuItemOption.delete({ where: { id: req.params.id } });
  res.json({ message: "Option deleted successfully" });
});

export const createItemSize = asyncHandler(async (req, res) => {
  const size = await prisma.menuItemSize.create({
    data: modifierCreateData(req.body, req.params.itemId),
  });

  res.status(201).json({ size: toMenuItemModifier(size) });
});

export const updateItemSize = asyncHandler(async (req, res) => {
  const size = await prisma.menuItemSize.update({
    where: { id: req.params.id },
    data: modifierUpdateData(req.body),
  });

  res.json({ size: toMenuItemModifier(size) });
});

export const deleteItemSize = asyncHandler(async (req, res) => {
  await prisma.menuItemSize.delete({ where: { id: req.params.id } });
  res.json({ message: "Size deleted successfully" });
});
