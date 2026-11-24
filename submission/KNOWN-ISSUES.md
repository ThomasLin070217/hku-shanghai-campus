# Known issues — submission 9.1.0

Source: WeChat group “Vibe Coding Hackathon CDS SH”, 2026-11-23 19:33–20:02, plus the sidebar reports on 2026-11-21. Triage is Task 12.5; fixes route to Workstreams 6, 8, 9 and 11.

| # | Report | Severity | Owner | Status |
|---|---|---|---|---|
| 1 | “很多bug / 小细节” during a play session; the group will post repros | P1 | 12.5 → 11.2 | Open; collect repros |
| 2 | UI changed without the teammate knowing (`你是不是改过ui了？`) | P2 | 10.3 | Open; compare against the last approved UI frame |
| 3 | Eight humanoid robots were added but are not in the current update | P1 | 6.4 | Open; reconcile the branch |
| 4 | Robot dog: “很帅” but check speed/details | P2 | 6.3 | Open; measure |
| 5 | Lion fight: story, quest and environment need a pass (`剧情，任务，环境`) | P1 | 9.4 | Open |
| 6 | “模型太慢了” — model/asset load is slow | P1 | 8.2 / 8.7 | Open; measure |
| 7 | Demo video expected | P1 | 10.7 | In progress (teaser v1 exists) |

**Tag rule:** P0/P1 must be fixed or explicitly listed here before the release tag. P2 may ship with a note.

**Security:** two `sk-` API keys were posted in the group chat on 2026-11-23 19:51/19:54. Treat them as compromised and rotate them; do not put them in the repo, the build or the tagged release. The Task 12.2 secret scan must fail on any `sk-` hit.
