import { appError } from "../lib/appError.js";
import { prisma } from "../lib/db.js";
import {
  localizedDescription,
  localizedName,
  parseLocale,
  parseOptionalText,
} from "../lib/menuLocale.js";

function toCategory(category, { localized = false, locale = "en" } = {}) {
  const { id, name, nameZh, sortOrder, isActive, createdAt, updatedAt } = category;
  const result = {
    id,
    name: localized ? localizedName(category, locale) : name,
    sortOrder,
    isActive,
    createdAt,
    updatedAt,
  };

  if (!localized) {
    result.nameZh = nameZh ?? null;
  }

  return result;
}

function toMenuItemOption(option, { localized = false, locale = "en" } = {}) {
  const { id, menuItemId, name, nameZh, priceDelta, sortOrder, isAvailable, createdAt, updatedAt } =
    option;
  const result = {
    id,
    menuItemId,
    name: localized ? localizedName(option, locale) : name,
    priceDelta: Number(priceDelta),
    sortOrder,
    isAvailable,
    createdAt,
    updatedAt,
  };

  if (!localized) {
    result.nameZh = nameZh ?? null;
  }

  return result;
}

function toMenuItem(item, { localized = false, locale = "en" } = {}) {
  const {
    id,
    itemNumber,
    name,
    nameZh,
    description,
    descriptionZh,
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
    name: localized ? localizedName(item, locale) : name,
    description: localized ? localizedDescription(item, locale) : description,
    price: Number(price),
    sortOrder,
    isAvailable,
    categoryId,
    createdAt,
    updatedAt,
  };

  if (!localized) {
    result.nameZh = nameZh ?? null;
    result.descriptionZh = descriptionZh ?? null;
  }

  if (options) {
    result.options = options.map((option) =>
      toMenuItemOption(option, { localized, locale }),
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

export async function getMenu(req, res, next) {
  try {
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

    res.json({
      categories: categories.map((category) => ({
        ...toCategory(category, { localized: true, locale }),
        items: category.items.map((item) =>
          toMenuItem(item, { localized: true, locale }),
        ),
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function getMenuAdmin(req, res, next) {
  try {
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
      categories: categories.map(toCategory),
      items: categories.flatMap((category) => category.items.map(toMenuItem)),
    });
  } catch (error) {
    next(error);
  }
}

export async function createCategory(req, res, next) {
  try {
    const name = parseRequiredName(req.body.name);
    const sortOrder = parseSortOrder(req.body.sortOrder);
    const isActive = req.body.isActive ?? true;
    const nameZh = parseOptionalText(req.body.nameZh) ?? null;

    const category = await prisma.category.create({
      data: { name, nameZh, sortOrder, isActive },
    });

    res.status(201).json({ category: toCategory(category) });
  } catch (error) {
    next(error);
  }
}

export async function updateCategory(req, res, next) {
  try {
    const { id } = req.params;
    const data = {};

    if (req.body.name !== undefined) {
      data.name = parseRequiredName(req.body.name);
    }

    if (req.body.nameZh !== undefined) {
      data.nameZh = parseOptionalText(req.body.nameZh);
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
      where: { id },
      data,
    });

    res.json({ category: toCategory(category) });
  } catch (error) {
    next(error);
  }
}

export async function deleteCategory(req, res, next) {
  try {
    const { id } = req.params;

    await prisma.category.delete({ where: { id } });

    res.json({ message: "Category deleted successfully" });
  } catch (error) {
    next(error);
  }
}

export async function createItem(req, res, next) {
  try {
    const name = parseRequiredName(req.body.name);
    const price = parsePrice(req.body.price);
    const categoryId = req.body.categoryId?.trim();

    if (!categoryId) {
      throw appError("categoryId is required");
    }

    const item = await prisma.menuItem.create({
      data: {
        name,
        nameZh: parseOptionalText(req.body.nameZh) ?? null,
        itemNumber: parseItemNumber(req.body.itemNumber),
        description: parseOptionalText(req.body.description),
        descriptionZh: parseOptionalText(req.body.descriptionZh) ?? null,
        price,
        sortOrder: parseSortOrder(req.body.sortOrder),
        isAvailable: req.body.isAvailable ?? true,
        categoryId,
      },
      include: itemInclude,
    });

    res.status(201).json({ item: toMenuItem(item) });
  } catch (error) {
    next(error);
  }
}

export async function updateItem(req, res, next) {
  try {
    const { id } = req.params;
    const data = {};

    if (req.body.name !== undefined) {
      data.name = parseRequiredName(req.body.name);
    }

    if (req.body.nameZh !== undefined) {
      data.nameZh = parseOptionalText(req.body.nameZh);
    }

    if (req.body.itemNumber !== undefined) {
      data.itemNumber = parseItemNumber(req.body.itemNumber);
    }

    if (req.body.description !== undefined) {
      data.description = parseOptionalText(req.body.description);
    }

    if (req.body.descriptionZh !== undefined) {
      data.descriptionZh = parseOptionalText(req.body.descriptionZh);
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
      where: { id },
      data,
      include: itemInclude,
    });

    res.json({ item: toMenuItem(item) });
  } catch (error) {
    next(error);
  }
}

export async function deleteItem(req, res, next) {
  try {
    const { id } = req.params;

    await prisma.menuItem.delete({ where: { id } });

    res.json({ message: "Item deleted successfully" });
  } catch (error) {
    next(error);
  }
}

export async function createItemOption(req, res, next) {
  try {
    const { itemId } = req.params;
    const name = parseRequiredName(req.body.name);
    const priceDelta = parsePrice(req.body.priceDelta ?? 0);
    const sortOrder = parseSortOrder(req.body.sortOrder);
    const isAvailable = req.body.isAvailable ?? true;
    const nameZh = parseOptionalText(req.body.nameZh) ?? null;

    const option = await prisma.menuItemOption.create({
      data: {
        menuItemId: itemId,
        name,
        nameZh,
        priceDelta,
        sortOrder,
        isAvailable,
      },
    });

    res.status(201).json({ option: toMenuItemOption(option) });
  } catch (error) {
    next(error);
  }
}

export async function updateItemOption(req, res, next) {
  try {
    const { id } = req.params;
    const data = {};

    if (req.body.name !== undefined) {
      data.name = parseRequiredName(req.body.name);
    }

    if (req.body.nameZh !== undefined) {
      data.nameZh = parseOptionalText(req.body.nameZh);
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
      where: { id },
      data,
    });

    res.json({ option: toMenuItemOption(option) });
  } catch (error) {
    next(error);
  }
}

export async function deleteItemOption(req, res, next) {
  try {
    const { id } = req.params;

    await prisma.menuItemOption.delete({ where: { id } });

    res.json({ message: "Option deleted successfully" });
  } catch (error) {
    next(error);
  }
}
