# Q&A separation and home entry correction

## Approved intent

Keep Q&A as question discovery and inline official answers, separate from long-form knowledge and OPS content. Retain the shared publication workflow, immutable history and server authorization. Fix the home cards' destinations and make pending navigation visible.

## Implementation

- Q&A keyword search and clickable category filters; inline answers are fetched on opening from a Q&A-only, private/no-store endpoint.
- Answers reuse the published document renderer, including native formatting and protected media. Heading anchors are namespaced per answer.
- Share links select one authorized question, independent of pagination. Old article links for Q&A redirect to this page.
- Knowledge home/list omit Q&A, OPS and Reference; reading neighbours are restricted to the selected content type. Global search and personal history remain cross-module discovery with the existing authorization.
- New `/help-centre/library` is an actual knowledge directory; home cards use navigation feedback and no longer truncate Q&A after the first three menu entries. Existing server-filtered menu visibility is retained.
- Admin offers knowledge, OPS and Q&A entries, with type-specific new-content actions. Question editing prominently labels question, category and answer; native editor/workflow machinery is reused.
- Migration `0028_qa_search` adds a narrow search function using the existing published text index. It does not rewrite content, grant table access, or change publication policies.

## Online reproduction before changes

Using the signed-in in-app browser: home Knowledge card linked to `#knowledge-documents` rather than a distinct page. OPS and Reference clicks both reached their expected routes and eventually displayed their respective empty collections. No evidence that those two links were broken; no production latency benchmark was taken this turn.

## Local validation

- Unit suite: 354 passed, including keyword validation and formatting-preserving answer anchor isolation.
- Build and compiled CSS guard passed; lint and diff whitespace checks passed.
- Isolated browser fixture on port 3216: question opens answer inline, no-result search, desktop and 390px mobile layout visually inspected. This fixture uses sample data and a mocked answer endpoint; it is not real-account acceptance.
- Complete isolated database suite: 386 passed. Database tests cover question/answer keyword matching, draft exclusion, hidden answer exclusion, direct non-Q&A rejection, revoked identity rejection, knowledge separation and old-link routing.

## Release boundary

Not pushed or deployed in this turn. Apply migration 0028 through the existing operator workflow before deploying the app, then verify Q&A search and inline answers with real published data. No production database or article mutations were performed.
