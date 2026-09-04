\set ON_ERROR_STOP on
-- Foreign keys without a usable index.
--
-- This is a standing check rather than a one-off fix: the reason there were
-- thirty-three is that creating an index is not part of writing a foreign
-- key, so one only appears if somebody goes looking. Two of the thirty-three
-- came from work done this same week. Asserting the count is zero means the
-- next one fails the suite instead of waiting to be noticed under load.

select 'no_foreign_key_on_a_res_table_lacks_an_index' as check,
  (select count(*) from pg_constraint c
    where c.contype = 'f'
      and c.connamespace = 'public'::regnamespace
      and c.conrelid::regclass::text like 'res\_%'
      and not exists (
        select 1 from pg_index i
        where i.indrelid = c.conrelid
          and (i.indkey::int2[])[0:array_length(c.conkey,1)-1] = c.conkey
      )) = 0 as pass;

-- Named as a spot check on the generated file: if the naming convention drifts
-- the assertion above still passes, but these say which shape was intended.
-- A spot check on the naming convention, scoped to the tables this harness
-- actually builds — the assertion above already covers correctness, this one
-- only pins the shape so the file stays readable.
select 'the_indexes_follow_the_table_column_idx_convention' as check,
  (select count(*) from pg_indexes
    where schemaname = 'public'
      and indexname in ('res_listings_property_id_idx',
                        'res_org_units_owner_user_id_idx',
                        'res_area_broadcasts_jurisdiction_id_idx'))
  = (select count(*) from (values
       ('res_listings'), ('res_org_units'), ('res_area_broadcasts')
     ) as t(tbl) where to_regclass('public.' || tbl) is not null) as pass;
