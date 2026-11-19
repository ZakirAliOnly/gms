# Member shifts and branch locker assignments

New-member registration and member editing include a required Morning / Evening
shift. Existing records remain unset until staff choose a shift; the migration
does not invent assignments for older members.

Add an extra named Locker (or containing the word Locker/Lockers, such as Monthly
Locker). Selecting that extra displays a required locker-number field. Other
extras do not require a locker number. Numbers accept letters and digits, e.g.
58 or A-12, up to 40 characters. Values are trimmed, uppercased, and normalized:
058 and 58 represent the same locker; a-12 and A-12 represent the same locker.

Locker numbers belong to a branch. Main Branch and Press Club Branch may each
assign 58, but two members within Main Branch cannot both hold 58. Duplicate
validation is backed by the unique database constraint on tenantId/lockerNumber,
so simultaneous requests cannot double-assign a locker. A conflict leaves the
member, payment, receipt counter and activity entry unchanged. The form retains
entered information so staff can correct the number.

A member can retain their current locker while editing. Removing their locker
extra (or changing its number) releases the previous number for another member.
Expiry or cancellation alone does not release the locker: staff must remove the
extra when the physical locker becomes available.

Shift and locker number appear in member lists/details, the scanner profile,
Members Data Viewer/exports, and member profile print data. Admission and renewal
thermal receipts show the saved shift and assigned locker number. Reprints use
the current member/locker information, consistent with existing package/contact
reprint behavior. Multiple locker extras have separately labeled numbers.

## Deployment

Run `npx prisma migrate deploy` before starting the new build. Migration
`20261119090000_member_shift_locker_number` adds the nullable Member.shift enum,
MembershipExtra.lockerNumber and its branch-specific unique index. Existing
members/extras remain intact, with unset new fields. Prisma Client must be
regenerated as part of the build/install process. No production migration or
VPS deployment was performed during implementation.

## Validation

Production Webpack build, ESLint and 73 unit/integration tests passed. The
migration matches the Prisma schema. Database tests covered concurrent duplicate
assignment, same-member edits, branch isolation, release/reassignment, normalized
numbers and admission/renewal receipt content. Production Chromium exercised the
actual forms, retained input after duplicate errors, member details, scanner,
Data Viewer, both thermal receipt types and locker 58 in two different branches.
