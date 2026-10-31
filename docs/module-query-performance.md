# Membership and activity query performance

The code review found avoidable database work on module pages. This is not a
profile of the live VPS: no VPS credentials or production measurements were
available.

Memberships previously issued four tab counts plus a separate list count on
ordinary visits, and queried active extras in addition to fetching all extras.
The tab counts now share a single tenant-scoped SQL aggregate; its result also
supplies the unsearched list total. Searched/scanned results retain a separate
filtered count. Active extras are derived from the existing extras result.

Activity summary cards previously fetched every matching action and JSON payload
and reduced them in the application. PostgreSQL now returns one aggregate row.
The type selector uses database GROUP BY instead of Prisma's application-side
distinct. Both queries retain the date/search/type/branch filters and Supervisor
exclusion of platform-only activity. Numeric strings in older metadata are
validated before casting, and transfers remain excluded from cash totals.

Authentication session reads are deduplicated within each server render. Database
clients reuse the process pool in production as well as development. Permissions
and disabled-session checks remain live; no user/business data cache was added.

Apply `20261031170000_module_query_indexes` with `npx prisma migrate deploy`
before restarting the release. It adds branch/date/order and branch/action/date
indexes for logs and a branch/status/renewal-date index for memberships.

## Local measurements

Synthetic fixtures in the isolated test database were deleted after measurement.
The figures are medians of five warm runs on local PostgreSQL and exclude HTTP,
authentication, JavaScript loading and network latency. They do not establish a
production page-load improvement.

| Query | Data size | Before | After |
| --- | --- | --- | --- |
| Activity totals | 100,000 events | 177 ms | 143 ms |
| Activity type options | 100,000 events | 83 ms | 14 ms |
| Four membership tab counts | 20,000 memberships | 10 ms | 6 ms |

Totals transfer one row instead of 100,000 JSON payloads. Ordinary membership
visits also avoid the duplicate list count and active-extras query, which the
count benchmark does not include.

Production Webpack build, ESLint and all 46 unit/integration tests passed. Tests
compare the aggregate membership counts with existing date/status rules and
compare activity aggregates with displayed event amounts across searches,
reversals, missing metadata and branch boundaries. Browser checks also cover
membership loading, live staff permissions and Supervisor branch filtering.

If the VPS still takes seconds, measure authenticated module requests and inspect
whether it runs `next start` (not `next dev`), application restarts/resource usage,
database connection/query timings and database location. The repository's PM2
configuration already specifies production mode. No VPS deployment was performed.
