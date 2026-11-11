-- Platform Phase 1a: required specs, final (owner, 11 Nov 2026).
--
--   vehicle type   always
--   transmission   motorbikes only
--   engine size    motorbikes only
-- For cars, ATVs, boats and "other" both are optional: a shop can add them
-- when it wants to. (An earlier rule the same day also required a
-- transmission for cars; that is withdrawn.)

alter table platform.models drop constraint models_required_specs_check;

alter table platform.models
  add constraint models_required_specs_check
  check (vehicle_type <> 'motorbike' or (cc is not null and transmission is not null));
