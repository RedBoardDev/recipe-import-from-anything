exports.up = (pgm) => {
  pgm.createTable("job_results", {
    job_id: {
      type: "uuid",
      primaryKey: true,
      references: "import_jobs(id)",
      onDelete: "cascade"
    },
    result: { type: "jsonb", notNull: true },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()")
    }
  });
};

exports.down = (pgm) => {
  pgm.dropTable("job_results");
};
