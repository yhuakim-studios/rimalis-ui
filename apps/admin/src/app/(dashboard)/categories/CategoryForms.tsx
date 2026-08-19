"use client";

import { useActionState, useState } from "react";
import type { CategoryNode } from "@/lib/category-tree";
import { Button, Input, Textarea } from "@/components/primitives";
import { FormBanner, SubmitButton } from "@/components/forms";
import { ConfirmAction } from "@/components/admin";
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/lib/category-actions";
import type { FormState } from "@/lib/form-state";

/** The options for a parent `<select>`, indented to show the hierarchy. */
export interface ParentOption {
  id: string;
  label: string;
}

/**
 * Add a category.
 *
 * On CREATE the empty parent option means "top level" — there is no third
 * "unchanged" state, unlike the edit form. See lib/category-actions.ts.
 */
export function CreateCategoryForm({ parents }: { parents: readonly ParentOption[] }) {
  const [state, formAction] = useActionState<FormState, FormData>(createCategory, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && <FormBanner tone="error">{state.error}</FormBanner>}
      {state.message && <FormBanner tone="success">{state.message}</FormBanner>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Name"
          name="name"
          required
          placeholder="Home & Kitchen"
          error={state.fieldErrors?.["name"]}
        />
        {/*
          A native select with indented labels rather than a tree widget. The
          hierarchy is two or three levels deep in practice, and a custom listbox is
          the most commonly broken widget on the web — see the note in Field.tsx.
        */}
        <label className="flex flex-col gap-1.5">
          <span className="text-caption font-medium">Parent</span>
          <select
            name="parentId"
            defaultValue=""
            className="h-11 rounded-input border border-divider-strong bg-surface px-3 text-caption focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            <option value="">No parent — top level</option>
            {parents.map((parent) => (
              <option key={parent.id} value={parent.id}>
                {parent.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Textarea
        label="Description"
        name="description"
        rows={2}
        hint="Optional. Shown on the storefront category page."
        error={state.fieldErrors?.["description"]}
      />

      <div>
        <SubmitButton>Add category</SubmitButton>
      </div>
    </form>
  );
}

/**
 * One row: rename, re-parent, or delete.
 *
 * ## Why editing is inline and collapsed
 *
 * The taxonomy is a list of twenty-odd short rows and the common operation is
 * reading it, not editing. Rendering every row as an open form would turn a
 * scannable tree into a wall of inputs; a separate edit page per category would
 * cost a navigation for a rename. Collapsed inline is the middle, and it needs no
 * modal — see the header of ConfirmAction.tsx.
 *
 * ## The parent select omits this category and its descendants
 *
 * Not because the API would accept it — it returns `CATEGORY_CYCLE` — but because
 * offering a choice that is guaranteed to fail is worse than not offering it. The
 * caller computes the safe set; this component just renders it.
 */
export function CategoryRow({
  category,
  depth,
  parentOptions,
}: {
  category: CategoryNode;
  depth: number;
  parentOptions: readonly ParentOption[];
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useActionState<FormState, FormData>(updateCategory, {});

  return (
    <li
      // Indentation communicates depth without a nested list, which keeps the
      // whole tree one flat `<ul>` and one `divide-y` — see flattenTree.
      style={{ paddingLeft: `${String(depth * 20)}px` }}
      className="flex flex-col gap-3 px-5 py-3"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-caption font-medium">{category.name}</span>
        <span className="font-mono text-meta text-ink-subtle">/{category.slug}</span>
        {category.description && (
          <span className="text-meta text-ink-subtle">{category.description}</span>
        )}
        <span className="ml-auto flex shrink-0 gap-2">
          <Button
            type="button"
            variant="tertiary"
            onClick={() => setEditing((open) => !open)}
          >
            {editing ? "Cancel" : "Edit"}
          </Button>
          <ConfirmAction
            action={deleteCategory}
            label="Delete"
            confirmLabel="Delete category"
            consequence="Categories have no soft delete — this cannot be undone. The API will refuse if any product or subcategory still points at it."
            danger
            hidden={{ categoryId: category.id }}
          />
        </span>
      </div>

      {state.error && <FormBanner tone="error">{state.error}</FormBanner>}
      {state.message && <FormBanner tone="success">{state.message}</FormBanner>}

      {editing && (
        <form
          action={formAction}
          className="flex flex-wrap items-end gap-3 rounded-input bg-canvas p-3"
        >
          <input type="hidden" name="categoryId" value={category.id} />
          <div className="min-w-[200px] flex-1">
            <Input
              label="Name"
              name="name"
              defaultValue={category.name}
              error={state.fieldErrors?.["name"]}
            />
          </div>
          <label className="flex min-w-[200px] flex-1 flex-col gap-1.5">
            <span className="text-caption font-medium">Parent</span>
            <select
              name="parentId"
              defaultValue={category.parentId ?? ""}
              className="h-11 rounded-input border border-divider-strong bg-surface px-3 text-caption focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <option value="">No parent — top level</option>
              {parentOptions.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {parent.label}
                </option>
              ))}
            </select>
          </label>
          <SubmitButton variant="secondary">Save</SubmitButton>
        </form>
      )}
    </li>
  );
}
