# Parked features

Date: 2026-08-10

Six files in this repository are not reachable from any entry point, and every
static analysis run reports them as dead code. They are not dead. Each one is a
finished, translated feature whose public page currently renders `<ComingSoon />`
because the launch has not happened, not because the work is missing.

This document exists so the next person to see that report does not have to
reconstruct the reasoning, and so nobody deletes 3,000 lines of ready product on
a linter's word.

## What is parked, and what is waiting for it

| File                                                             | Lines | The page waiting for it                    | Translations                               | Data                 |
| ---------------------------------------------------------------- | ----- | ------------------------------------------ | ------------------------------------------ | -------------------- |
| `components/sections/experiences/education-section.tsx`          | 632   | `/experiences/education-programs`          | `experiences.education.hero`, 6 keys       | —                    |
| `components/sections/experiences/education-register-section.tsx` | 653   | `/experiences/education-programs/register` | `experiences.education.register`, 14 keys  | `education_sessions` |
| `components/sections/experiences/running-club-section.tsx`       | 539   | `/experiences/running-club`                | `experiences.runningClub.hero`, 5 keys     | —                    |
| `components/sections/experiences/run-register-section.tsx`       | 592   | `/experiences/running-club/register`       | `experiences.runningClub.register`, 9 keys | `races`              |
| `components/sections/home/membership-teaser.tsx`                 | 172   | the home page, where it is commented out   | `home.membershipTeaser`, 5 keys            | —                    |
| `components/sections/booking/steps/location-step.tsx`            | 404   | the public booking flow                    | `booking.locationStep`, 15 keys            | —                    |

Every namespace above is complete in **both** English and Spanish — 54 keys in
total. Nobody translates dead code twice.

## Why these are not leftovers

**The back half already runs.** The dashboard has full screens for races and
education sessions: creating them, listing enrolments, checking people in. The
centre administers events today that the public cannot yet see or sign up for.
What is missing is the public half, and the public half is in the table above.

**The routes exist and are translated.** `i18n/routing.ts` carries all four
experiences routes with their Spanish paths. The pages are real pages; they just
render a placeholder.

**The booking flow lost a question, not a capability.** The dashboard still
takes bookings at the centre, in a hotel room and at an address. The public flow
hardcodes `location: "centro"`. `location-step.tsx` is the step that used to
ask, and it is the starting point if visitors are ever offered the other two
again.

## What would make the report go to zero

Only two things, and both are decisions rather than edits:

1. **Launch the page.** Replace `<ComingSoon />` with the section, and the file
   becomes reachable.
2. **Retire the feature.** Then delete the file _and_ its translation keys in
   `messages/en` and `messages/es`, so the two never drift apart.

Suppressing the rule is not on that list. The report is telling the truth about
reachability; it simply cannot know about a launch date.

## If you are retiring one

Delete these together, per feature:

- Running club: `running-club-section.tsx`, `run-register-section.tsx`, the
  `experiences.runningClub` namespaces, the two `/experiences/running-club`
  routes and their pages.
- Education programmes: `education-section.tsx`,
  `education-register-section.tsx`, the `experiences.education` namespaces, the
  two `/experiences/education-programs` routes and their pages.
- Membership teaser: `membership-teaser.tsx`, `home.membershipTeaser`, and the
  commented-out block in the home page.
- Booking locations: `location-step.tsx` and `booking.locationStep`. The
  dashboard's own location handling is separate and stays.

The dashboard screens for races and education sessions are **not** part of
either bundle. They are in use.
