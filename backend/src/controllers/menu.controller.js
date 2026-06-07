import { prisma } from "../lib/db.js";

function toCategory(category) {
  const { id, name, sortOrder, isActive, createdAt, updatedAt } = category;
  return { id, name, sortOrder, isActive, createdAt, updatedAt };
}

function toMenuItem(item) {
  const { id, name, description, price, sortOrder, isAvailable, categoryId, createdAt, updatedAt } = item;
  return { id, name, description, price: Number(price), sortOrder, isAvailable, categoryId, createdAt, updatedAt };
}

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function parseSortOrder(value, fallback = 0) {
  if (value === undefined || value === null) {
    return fallback;
  }

  const sortOrder = Number(value);
  if (!Number.isInteger(sortOrder)) {
    throw badRequest("sortOrder must be an integer");
  }

  return sortOrder;
}

function parsePrice(value) {
  const price = Number(value);
  if (Number.isNaN(price) || price < 0) {
    throw badRequest("price must be a non-negative number");
  }

  return Math.round(price * 100) / 100;
}

function parseRequiredName(name) {
  const trimmed = name?.trim();
  if (!trimmed) {
    throw badRequest("name is required");
  }

  return trimmed;
}

const categoryOrder = [{ sortOrder: "asc" }, { name: "asc" }];
const itemOrder = [{ sortOrder: "asc" }, { name: "asc" }];

export async function getMenu(req, res, next) {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: categoryOrder,
      include: {
        items: {
          where: { isAvailable: true },
          orderBy: itemOrder,
        },
      },
    });

    res.json({
      categories: categories.map((category) => ({
        ...toCategory(category),
        items: category.items.map(toMenuItem),
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function listCategories(req, res, next) {
  try {
    const categories = await prisma.category.findMany({
      orderBy: categoryOrder,
    });

    res.json({ categories: categories.map(toCategory) });
  } catch (error) {
    next(error);
  }
}

export async function createCategory(req, res, next) {
  try {
    const name = parseRequiredName(req.body.name);
    const sortOrder = parseSortOrder(req.body.sortOrder);
    const isActive = req.body.isActive ?? true;

    const category = await prisma.category.create({
      data: { name, sortOrder, isActive },
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

    if (req.body.sortOrder !== undefined) {
      data.sortOrder = parseSortOrder(req.body.sortOrder);
    }

    if (req.body.isActive !== undefined) {
      data.isActive = Boolean(req.body.isActive);
    }

    if (Object.keys(data).length === 0) {
      throw badRequest("No valid fields to update");
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

export async function listItems(req, res, next) {
  try {
    const { categoryId } = req.query;
    const where = categoryId ? { categoryId } : undefined;

    const items = await prisma.menuItem.findMany({
      where,
      orderBy: itemOrder,
    });

    res.json({ items: items.map(toMenuItem) });
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
      throw badRequest("categoryId is required");
    }

    const item = await prisma.menuItem.create({
      data: {
        name,
        description: req.body.description?.trim() || null,
        price,
        sortOrder: parseSortOrder(req.body.sortOrder),
        isAvailable: req.body.isAvailable ?? true,
        categoryId,
      },
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

    if (req.body.description !== undefined) {
      data.description = req.body.description?.trim() || null;
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
        throw badRequest("categoryId cannot be empty");
      }
      data.categoryId = categoryId;
    }

    if (Object.keys(data).length === 0) {
      throw badRequest("No valid fields to update");
    }

    const item = await prisma.menuItem.update({
      where: { id },
      data,
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
