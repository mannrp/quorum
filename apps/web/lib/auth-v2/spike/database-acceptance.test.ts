import { describe, expect, it } from "vitest";

import {
  assessAuthSchemaIsolation,
  assessStoredSessionCredential,
  createdCatalogObjects,
} from "./database-acceptance";

describe("auth schema isolation acceptance", () => {
  const validSnapshot = {
    searchPath: ["better_auth", "pg_catalog", "pg_temp"],
    objects: [
      { schema: "better_auth", name: "user", kind: "table" },
      { schema: "better_auth", name: "session", kind: "table" },
      { schema: "better_auth", name: "session_id_seq", kind: "sequence" },
    ],
  };

  it("accepts a nonempty canonical schema with the exact isolated search path", () => {
    expect(assessAuthSchemaIsolation(validSnapshot)).toEqual({ accepted: true });
  });

  it.each([
    [
      { ...validSnapshot, searchPath: ["better_auth", "public"] },
      "unsafe-search-path",
    ],
    [{ ...validSnapshot, objects: [] }, "empty-schema"],
    [
      {
        ...validSnapshot,
        objects: [
          ...validSnapshot.objects,
          { schema: "public", name: "session", kind: "table" },
        ],
      },
      "object-outside-better-auth",
    ],
    [
      {
        ...validSnapshot,
        objects: [
          ...validSnapshot.objects,
          { schema: "auth", name: "account", kind: "table" },
        ],
      },
      "object-in-reserved-auth",
    ],
  ] as const)("rejects unsafe catalog state", (snapshot, reason) => {
    expect(assessAuthSchemaIsolation(snapshot)).toEqual({
      accepted: false,
      reason,
    });
  });

  it("isolates newly created candidate objects from the existing catalog", () => {
    const before = [
      { schema: "public", name: "users", kind: "table" },
      { schema: "app", name: "projects", kind: "table" },
    ];
    const after = [
      ...before,
      { schema: "better_auth", name: "session", kind: "table" },
      { schema: "better_auth", name: "session_id_seq", kind: "sequence" },
    ];

    expect(createdCatalogObjects(before, after)).toEqual([
      { schema: "better_auth", name: "session", kind: "table" },
      { schema: "better_auth", name: "session_id_seq", kind: "sequence" },
    ]);
    expect(
      assessAuthSchemaIsolation({
        searchPath: ["better_auth", "pg_catalog", "pg_temp"],
        objects: createdCatalogObjects(before, after),
      }),
    ).toEqual({ accepted: true });
  });

  it("retains a newly created public object in the diff so isolation fails", () => {
    const before = [{ schema: "public", name: "users", kind: "table" }];
    const after = [
      ...before,
      { schema: "better_auth", name: "session", kind: "table" },
      { schema: "public", name: "candidate_account", kind: "table" },
    ];

    expect(
      assessAuthSchemaIsolation({
        searchPath: ["better_auth", "pg_catalog", "pg_temp"],
        objects: createdCatalogObjects(before, after),
      }),
    ).toEqual({ accepted: false, reason: "object-outside-better-auth" });
  });
});

describe("database session credential-at-rest acceptance", () => {
  it("accepts a non-reusable digest hidden from application roles", () => {
    expect(
      assessStoredSessionCredential({
        browserCredentialFingerprint: "browser-fingerprint",
        storedValueFingerprint: "different-digest-fingerprint",
        storedValueForm: "one-way-digest",
        readableByApplicationRole: false,
      }),
    ).toEqual({ accepted: true, disposition: "digest" });
  });

  it("requires an explicit risk decision for a directly reusable DB value", () => {
    expect(
      assessStoredSessionCredential({
        browserCredentialFingerprint: "same-fingerprint",
        storedValueFingerprint: "same-fingerprint",
        storedValueForm: "plaintext-or-reversible",
        readableByApplicationRole: false,
      }),
    ).toEqual({
      accepted: false,
      reason: "reusable-value-needs-risk-decision",
    });
  });

  it("rejects application-role access regardless of storage form", () => {
    expect(
      assessStoredSessionCredential({
        browserCredentialFingerprint: "browser-fingerprint",
        storedValueFingerprint: "digest-fingerprint",
        storedValueForm: "one-way-digest",
        readableByApplicationRole: true,
      }),
    ).toEqual({ accepted: false, reason: "application-role-can-read" });
  });

  it("rejects unclassified storage evidence", () => {
    expect(
      assessStoredSessionCredential({
        browserCredentialFingerprint: "browser-fingerprint",
        storedValueFingerprint: "stored-fingerprint",
        storedValueForm: "unknown",
        readableByApplicationRole: false,
      }),
    ).toEqual({ accepted: false, reason: "storage-form-unknown" });
  });
});
