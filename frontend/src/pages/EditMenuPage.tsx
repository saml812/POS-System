import { useCallback, useEffect, useMemo, useState } from "react";
import * as menuApi from "../api/menu";
import { CategoryForm } from "../components/menu/CategoryForm";
import { ItemForm } from "../components/menu/ItemForm";
import { ModifierEditor, type Modifier } from "../components/menu/ModifierEditor";
import { MenuAdminItemRow } from "../components/menu/MenuAdminItemRow";
import { Banner } from "../components/ui/Banner";
import { useAuth } from "../context/AuthContext";
import { useLocale } from "../context/LocaleContext";
import { useAsyncAction } from "../hooks/useAsyncAction";
import {
  createItemModifiers,
  draftModifierHandlers,
  persistedModifierHandlers,
} from "../lib/menuModifiers";
import { isManager } from "../lib/permissions";
import type { Category, MenuItem } from "../types";

export function EditMenuPage() {
  const { user } = useAuth();
  const { t } = useLocale();
  const manager = isManager(user);

  const optionLabels = useMemo(
    () => ({
      title: t("menu.optionsTitle"),
      desc: t("menu.optionsDesc"),
      empty: t("menu.noOptions"),
      namePlaceholder: t("menu.optionNamePlaceholder"),
      pricePlaceholder: t("common.price"),
      available: t("menu.optionAvailable"),
      add: t("menu.addOption"),
      confirmDelete: (name: string) => t("menu.confirmDeleteOption", { name }),
    }),
    [t],
  );

  const sizeLabels = useMemo(
    () => ({
      title: t("menu.sizesTitle"),
      desc: t("menu.sizesDesc"),
      empty: t("menu.noSizes"),
      namePlaceholder: t("menu.sizeNamePlaceholder"),
      pricePlaceholder: t("common.price"),
      available: t("menu.sizeAvailable"),
      add: t("menu.addSize"),
      confirmDelete: (name: string) => t("menu.confirmDeleteSize", { name }),
    }),
    [t],
  );

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [showNewCategory, setShowNewCategory] = useState(false);
  const [showNewItem, setShowNewItem] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [draftOptions, setDraftOptions] = useState<Modifier[]>([]);
  const [draftSizes, setDraftSizes] = useState<Modifier[]>([]);

  const loadData = useCallback(async () => {
    const data = await menuApi.getMenuAdmin();
    setCategories(data.categories);
    setItems(data.items);
  }, []);

  const { error, success, busy, run } = useAsyncAction(t("common.requestFailed"));

  useEffect(() => {
    loadData()
      .catch((err: Error) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, [loadData]);

  const itemsByCategory = useMemo(
    () =>
      categories.map((category) => ({
        category,
        items: items
          .filter((item) => item.categoryId === category.id)
          .sort(
            (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
          ),
      })),
    [categories, items],
  );

  useEffect(() => {
    if (itemsByCategory.length === 0) return;
    if (!itemsByCategory.some((group) => group.category.id === activeCategoryId)) {
      setActiveCategoryId(itemsByCategory[0].category.id);
    }
  }, [itemsByCategory, activeCategoryId]);

  const activeGroup = useMemo(
    () =>
      itemsByCategory.find((group) => group.category.id === activeCategoryId) ??
      itemsByCategory[0] ??
      null,
    [itemsByCategory, activeCategoryId],
  );

  const totalItems = items.length;
  const activeCategories = categories.filter((category) => category.isActive).length;

  function closeCreatePanels() {
    setShowNewCategory(false);
    setShowNewItem(false);
    setDraftOptions([]);
    setDraftSizes([]);
  }

  function openNewItemPanel() {
    closeCreatePanels();
    setEditingCategoryId(null);
    setEditingItemId(null);
    setShowNewItem(true);
  }

  async function runMenuAction(
    action: () => Promise<unknown>,
    successMessage?: string,
  ) {
    await run(action, { successMessage, onAfter: loadData });
  }

  const displayError = loadError || error;

  return (
    <div className="page em-page">
      <header className="em-hero">
        <div className="em-hero-text">
          <h1>{t("menu.title")}</h1>
          <p>{t("menu.subtitle")}</p>
        </div>
        {manager ? (
          <div className="em-hero-actions">
            <button
              type="button"
              className={`btn ${showNewCategory ? "btn-secondary" : "btn-brand"}`}
              disabled={busy}
              onClick={() => {
                setShowNewCategory((open) => !open);
                setShowNewItem(false);
                setEditingCategoryId(null);
                setEditingItemId(null);
              }}
            >
              {showNewCategory ? t("common.close") : t("menu.addCategory")}
            </button>
            <button
              type="button"
              className={`btn ${showNewItem ? "btn-secondary" : "btn-secondary em-btn-outline"}`}
              disabled={busy || categories.length === 0}
              onClick={() => {
                if (showNewItem) {
                  closeCreatePanels();
                } else {
                  openNewItemPanel();
                }
                setShowNewCategory(false);
              }}
            >
              {showNewItem ? t("common.close") : t("menu.addItem")}
            </button>
          </div>
        ) : null}
      </header>

      {!manager ? <Banner variant="warning">{t("menu.roleWarning")}</Banner> : null}

      {!loading ? (
        <div className="em-stats">
          <div className="em-stat">
            <span className="em-stat-value">{categories.length}</span>
            <span className="em-stat-label">{t("menu.categories")}</span>
          </div>
          <div className="em-stat">
            <span className="em-stat-value">{activeCategories}</span>
            <span className="em-stat-label">{t("menu.active")}</span>
          </div>
          <div className="em-stat">
            <span className="em-stat-value">{totalItems}</span>
            <span className="em-stat-label">{t("menu.items")}</span>
          </div>
        </div>
      ) : null}

      {displayError ? <Banner variant="error">{displayError}</Banner> : null}
      {success ? <Banner variant="success">{success}</Banner> : null}
      {loading ? <p className="em-loading">{t("menu.loading")}</p> : null}

      {manager && showNewCategory ? (
        <section className="em-form-panel">
          <h3>{t("menu.newCategory")}</h3>
          <CategoryForm
            submitLabel={t("menu.createCategory")}
            onCancel={() => setShowNewCategory(false)}
            onSubmit={async (values) => {
              await runMenuAction(
                () => menuApi.createCategory(values),
                t("menu.createdCategory"),
              );
              setShowNewCategory(false);
            }}
          />
        </section>
      ) : null}

      {manager && showNewItem ? (
        <section className="em-form-panel">
          <h3>{t("menu.newItem")}</h3>
          <ItemForm
            id="new-item-form"
            categories={categories}
            defaultCategoryId={activeCategoryId || categories[0]?.id}
            submitLabel={t("menu.createItem")}
            hideActions
            onSubmit={async (values) => {
              await run(
                async () => {
                  const { item } = await menuApi.createItem({
                    name: values.name,
                    itemNumber: values.itemNumber || null,
                    price: values.price,
                    categoryId: values.categoryId,
                    description: values.description || undefined,
                    sortOrder: values.sortOrder,
                    isAvailable: values.isAvailable,
                  });

                  await createItemModifiers(
                    item.id,
                    draftOptions,
                    menuApi.createItemOption,
                  );
                  await createItemModifiers(
                    item.id,
                    draftSizes,
                    menuApi.createItemSize,
                  );
                },
                {
                  successMessage: t("menu.createdItem"),
                  onAfter: async () => {
                    await loadData();
                    closeCreatePanels();
                    setActiveCategoryId(values.categoryId);
                  },
                },
              );
            }}
          />
          <ModifierEditor
            modifiers={draftSizes}
            labels={sizeLabels}
            busy={busy}
            {...draftModifierHandlers(setDraftSizes)}
          />
          <ModifierEditor
            modifiers={draftOptions}
            labels={optionLabels}
            busy={busy}
            {...draftModifierHandlers(setDraftOptions)}
          />
          <div className="em-form-actions">
            <button
              type="submit"
              form="new-item-form"
              className="btn btn-brand"
              disabled={busy}
            >
              {busy ? t("common.saving") : t("menu.createItem")}
            </button>
            <button
              type="button"
              className="btn btn-small"
              disabled={busy}
              onClick={() => closeCreatePanels()}
            >
              {t("common.cancel")}
            </button>
          </div>
        </section>
      ) : null}

      {!loading && itemsByCategory.length === 0 ? (
        <div className="em-empty-state">
          <p>{t("menu.noCategories")}</p>
          {manager ? (
            <button
              type="button"
              className="btn btn-brand"
              onClick={() => setShowNewCategory(true)}
            >
              {t("menu.addCategory")}
            </button>
          ) : null}
        </div>
      ) : null}

      {!loading && itemsByCategory.length > 0 ? (
        <>
          <nav className="em-category-nav" aria-label={t("menu.categories")}>
            {itemsByCategory.map(({ category, items: categoryItems }) => (
              <button
                key={category.id}
                type="button"
                className={`em-category-pill ${activeCategoryId === category.id ? "active" : ""} ${!category.isActive ? "inactive" : ""}`}
                onClick={() => {
                  setActiveCategoryId(category.id);
                  setEditingCategoryId(null);
                  setEditingItemId(null);
                }}
              >
                {category.name}
                <span className="em-pill-count">{categoryItems.length}</span>
              </button>
            ))}
          </nav>

          {activeGroup ? (
            <section
              className={`em-category-panel ${!activeGroup.category.isActive ? "category-inactive" : ""}`}
            >
              {editingCategoryId === activeGroup.category.id && manager ? (
                <div className="em-form-panel em-form-panel-inline">
                  <h3>{t("menu.editCategory")}</h3>
                  <CategoryForm
                    initial={activeGroup.category}
                    submitLabel={t("menu.saveCategory")}
                    onCancel={() => setEditingCategoryId(null)}
                    onSubmit={async (values) => {
                      await runMenuAction(
                        () =>
                          menuApi.updateCategory(activeGroup.category.id, values),
                        t("menu.updatedCategory"),
                      );
                      setEditingCategoryId(null);
                    }}
                  />
                </div>
              ) : (
                <div className="em-category-bar">
                  <div className="em-category-info">
                    <h2>{activeGroup.category.name}</h2>
                    <div className="em-category-badges">
                      <span
                        className={`em-status-pill ${activeGroup.category.isActive ? "available" : "unavailable"}`}
                      >
                        {activeGroup.category.isActive
                          ? t("menu.pillActive")
                          : t("menu.pillInactive")}
                      </span>
                      <span className="em-meta-pill">
                        {t("common.sort")} {activeGroup.category.sortOrder}
                      </span>
                      <span className="em-meta-pill">
                        {t("menu.itemCount", {
                          count: activeGroup.items.length,
                        })}
                      </span>
                    </div>
                  </div>
                  {manager ? (
                    <div className="em-category-actions">
                      <button
                        type="button"
                        className="em-icon-btn"
                        disabled={busy}
                        onClick={() => {
                          closeCreatePanels();
                          setEditingItemId(null);
                          setEditingCategoryId(activeGroup.category.id);
                        }}
                      >
                        {t("common.edit")}
                      </button>
                      <button
                        type="button"
                        className="em-icon-btn danger"
                        disabled={busy}
                        onClick={() => {
                          if (
                            confirm(
                              t("menu.confirmDeleteCategory", {
                                name: activeGroup.category.name,
                                count: activeGroup.items.length,
                              }),
                            )
                          ) {
                            runMenuAction(
                              () =>
                                menuApi.deleteCategory(activeGroup.category.id),
                              t("menu.deletedCategory"),
                            );
                          }
                        }}
                      >
                        {t("common.delete")}
                      </button>
                    </div>
                  ) : null}
                </div>
              )}

              <div className="em-item-list">
                {activeGroup.items.length === 0 ? (
                  <div className="em-empty-category">
                    <p>{t("menu.emptyCategory")}</p>
                    {manager ? (
                      <button
                        type="button"
                        className="btn btn-brand"
                        disabled={busy}
                        onClick={() => openNewItemPanel()}
                      >
                        {t("menu.addItem")}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  activeGroup.items.map((item) =>
                    editingItemId === item.id && manager ? (
                      <div key={item.id} className="em-item-edit-panel">
                        <h4>{t("menu.editItem")}</h4>
                        <ItemForm
                          id={`edit-item-form-${item.id}`}
                          categories={categories}
                          initial={item}
                          submitLabel={t("menu.saveItem")}
                          hideActions
                          onSubmit={async (values) => {
                            await runMenuAction(
                              () =>
                                menuApi.updateItem(item.id, {
                                  name: values.name,
                                  itemNumber: values.itemNumber || null,
                                  description: values.description || null,
                                  price: values.price,
                                  sortOrder: values.sortOrder,
                                  isAvailable: values.isAvailable,
                                  categoryId: values.categoryId,
                                }),
                              t("menu.updatedItem"),
                            );
                            setEditingItemId(null);
                            setActiveCategoryId(values.categoryId);
                          }}
                        />
                        <ModifierEditor
                          modifiers={item.sizes ?? []}
                          labels={sizeLabels}
                          busy={busy}
                          {...persistedModifierHandlers(
                            item.id,
                            {
                              create: menuApi.createItemSize,
                              update: menuApi.updateItemSize,
                              delete: menuApi.deleteItemSize,
                            },
                            {
                              created: t("menu.createdSize"),
                              updated: t("menu.updatedSize"),
                              deleted: t("menu.deletedSize"),
                            },
                            runMenuAction,
                          )}
                        />
                        <ModifierEditor
                          modifiers={item.options ?? []}
                          labels={optionLabels}
                          busy={busy}
                          {...persistedModifierHandlers(
                            item.id,
                            {
                              create: menuApi.createItemOption,
                              update: menuApi.updateItemOption,
                              delete: menuApi.deleteItemOption,
                            },
                            {
                              created: t("menu.createdOption"),
                              updated: t("menu.updatedOption"),
                              deleted: t("menu.deletedOption"),
                            },
                            runMenuAction,
                          )}
                        />
                        <div className="em-form-actions">
                          <button
                            type="submit"
                            form={`edit-item-form-${item.id}`}
                            className="btn btn-brand"
                            disabled={busy}
                          >
                            {busy ? t("common.saving") : t("menu.saveItem")}
                          </button>
                          <button
                            type="button"
                            className="btn btn-small"
                            disabled={busy}
                            onClick={() => setEditingItemId(null)}
                          >
                            {t("common.cancel")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <MenuAdminItemRow
                        key={item.id}
                        item={item}
                        busy={busy}
                        canEdit={manager}
                        onEdit={() => {
                          closeCreatePanels();
                          setEditingCategoryId(null);
                          setEditingItemId(item.id);
                        }}
                        onDelete={() => {
                          if (
                            confirm(
                              t("common.confirmDelete", { name: item.name }),
                            )
                          ) {
                            runMenuAction(
                              () => menuApi.deleteItem(item.id),
                              t("menu.deletedItem"),
                            );
                          }
                        }}
                      />
                    ),
                  )
                )}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
