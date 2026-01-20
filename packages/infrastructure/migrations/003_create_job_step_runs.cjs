exports.up = (pgm) => {
  pgm.createTable("job_step_runs", {
    id: { type: "uuid", primaryKey: true },
    job_id: {
      type: "uuid",
      notNull: true,
      references: "import_jobs(id)",
      onDelete: "cascade"
    },
    step_id: { type: "text", notNull: true },
    status: { type: "text", notNull: true },
    started_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()")
    },
    ended_at: { type: "timestamptz" },
    duration_ms: { type: "integer" },
    error: { type: "jsonb" },
    output_ref: { type: "text" },
    meta: { type: "jsonb" }
  });

  pgm.createIndex("job_step_runs", "job_id");
  pgm.createIndex("job_step_runs", "status");
};

exports.down = (pgm) => {
  pgm.dropTable("job_step_runs");
};
