exports.up = (pgm) => {
  pgm.createTable("import_jobs", {
    id: { type: "uuid", primaryKey: true },
    user_id: { type: "text", notNull: true },
    source_type: { type: "text", notNull: true },
    payload: { type: "jsonb", notNull: true },
    options: { type: "jsonb", notNull: true },
    status: { type: "text", notNull: true },
    progress_pct: { type: "integer", notNull: true, default: 0 },
    current_step: { type: "text" },
    warnings: { type: "jsonb", notNull: true, default: "[]" },
    errors: { type: "jsonb", notNull: true, default: "[]" },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()")
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()")
    }
  });

  pgm.createIndex("import_jobs", "user_id");
  pgm.createIndex("import_jobs", "status");
};

exports.down = (pgm) => {
  pgm.dropTable("import_jobs");
};
