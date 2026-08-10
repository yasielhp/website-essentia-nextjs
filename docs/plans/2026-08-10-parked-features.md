# Parked features — resolved 2026-08-10

Six files in this repository were unreachable from any entry point, and every
static analysis run reported them as dead code. They were not dead: each was a
finished, translated feature whose public page rendered `<ComingSoon />` because
the launch had not happened, not because the work was missing.

That is settled now. Three features launched, one retired. Nothing was deleted
on a linter's word.

## Launched

| Feature            | Files                                             | Now reachable from                                |
| ------------------ | ------------------------------------------------- | ------------------------------------------------- |
| Running club       | `running-club-section`, `run-register-section`    | `/experiences/running-club` and `/register`       |
| Education programs | `education-section`, `education-register-section` | `/experiences/education-programs` and `/register` |
| Membership teaser  | `home/membership-teaser`                          | the home page                                     |

Launching a page is four edits, and all four matter:

1. `<ComingSoon />` gives way to the section.
2. The route leaves `UNLAUNCHED_ROUTES`, which puts it back in the sitemap.
3. `robots: UNLAUNCHED_ROBOTS` comes off the metadata, so it may be indexed.
4. The `comingSoon: true` badge comes off the nav entry in `constants/menu.tsx`.

Miss the last two and the page is live but tells search engines to ignore it,
while the menu still promises it for later.

`public/llms-full.txt` already described the running club and the education
programmes as real, with schedules and descriptions. It was making a promise the
site then broke on arrival — the worst outcome for a citation. The promise is
kept now, so those entries stand as written.

## Retired

**The public booking flow's location step.** `booking/steps/location-step.tsx`
and the `booking.locationStep` namespaces in `messages/en` and `messages/es`
are gone. The public flow keeps doing what it already did: every booking is at
the centre.

The dashboard's own location handling is a different thing entirely and stays —
staff still take bookings at the centre, in a hotel room and at an address. If
visitors are ever offered the other two again, the dashboard's
`bookings/_shared/location` is the place to start, not this deleted file.

## The rule that reported them

`deslop/unused-file` was telling the truth about reachability the whole time. It
simply could not know about a launch date. It reads zero now because the
decisions were made, not because it was silenced.
