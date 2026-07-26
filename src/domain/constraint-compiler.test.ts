import { describe, expect, it } from "vitest"
import {
  compileConstraint,
  DuplicateConstraintKeyError,
  initialProperties,
} from "@/domain/constraint-compiler"
import type { Constraint, ConstraintField } from "@/domain/models"

function field(
  key: string,
  type: ConstraintField["type"],
  patch: Partial<ConstraintField> = {},
): ConstraintField {
  return {
    id: key,
    key,
    label: key,
    description: "",
    type,
    required: false,
    options: [],
    min: null,
    max: null,
    ...patch,
  }
}

function constraint(fields: ConstraintField[]): Constraint {
  return {
    id: "constraint",
    projectId: "project",
    name: "测试",
    description: "",
    fields,
    createdAt: 1,
    updatedAt: 1,
  }
}

describe("compileConstraint", () => {
  it("validates all supported field shapes", () => {
    const schema = compileConstraint(
      constraint([
        field("name", "string", { required: true }),
        field("note", "text"),
        field("level", "number", { min: 1, max: 5 }),
        field("open", "boolean", { required: true }),
        field("kind", "enum", { options: ["A", "B"], required: true }),
        field("date", "date"),
        field("color", "color"),
      ]),
    )
    expect(
      schema.safeParse({
        name: "大厅",
        note: "",
        level: 3,
        open: true,
        kind: "A",
        date: "2026-07-26",
        color: "#aabbcc",
      }).success,
    ).toBe(true)
  })

  it("enforces required strings, numeric bounds and enum options", () => {
    const schema = compileConstraint(
      constraint([
        field("name", "string", { required: true }),
        field("level", "number", { min: 1, max: 5 }),
        field("kind", "enum", { options: ["A", "B"] }),
      ]),
    )
    expect(schema.safeParse({ name: "", level: 3, kind: "A" }).success).toBe(
      false,
    )
    expect(schema.safeParse({ name: "ok", level: 9, kind: "A" }).success).toBe(
      false,
    )
    expect(schema.safeParse({ name: "ok", level: 3, kind: "C" }).success).toBe(
      false,
    )
  })

  it("rejects duplicate keys before building the object", () => {
    expect(() =>
      compileConstraint(
        constraint([field("same", "string"), field("same", "number")]),
      ),
    ).toThrow(DuplicateConstraintKeyError)
  })
})

describe("initialProperties", () => {
  it("uses explicit defaults and type-appropriate empty values", () => {
    expect(
      initialProperties(
        constraint([
          field("name", "string", { defaultValue: "未命名" }),
          field("open", "boolean"),
          field("count", "number"),
        ]),
      ),
    ).toEqual({ name: "未命名", open: false, count: undefined })
    expect(initialProperties(null)).toEqual({})
  })
})
