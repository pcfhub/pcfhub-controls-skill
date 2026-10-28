# Web API messages: functions and actions

The messages `context.webAPI` cannot address — a **function** (a GET) and an
**action** (a POST) — called by a same-origin `fetch` from a control on a form:
the URL shapes, the headers, the answers and the refusals, and the rig that
stands in for them.

Split out of `context-apis.md` on 15 Oct 2026, so each file can be read whole.

- [Calling a Web API function `context.webAPI` cannot](#calling-a-web-api-function-contextwebapi-cannot)
- [Calling a Web API action](#calling-a-web-api-action)

## Calling a Web API function `context.webAPI` cannot

`context.webAPI` addresses **records by entity logical name** and nothing
else. Two things live outside that: metadata (`EntityDefinitions`, which
*Reading a hierarchy through FetchXML* and *Writing a lookup through the Web
API* already fetch) and **messages** — the functions and actions the Web API
exposes as URLs of their own. A **function** is a GET and is reachable with the
same same-origin `fetch`; an **action** is a POST, and *Calling a Web API
action* below has it, measured. `pcf-audit-history` is the exemplar for a
function: a record's audit
history is behind three functions, and the design below is what they forced.

**The two URL shapes.** A function *bound* to a row hangs off that row's
address with its fully qualified name:

```
GET {clientUrl}/api/data/v9.2/audits(<auditid>)/Microsoft.Dynamics.CRM.RetrieveAuditDetails
```

An *unbound* function takes its parameters as `@`-aliases, named in the
parentheses and supplied in the query string — a string quoted `'…'`, an
entity reference as `{'@odata.id':'<entity set>(<id>)'}`, a complex type as
JSON, each `encodeURIComponent`ed:

```
GET {clientUrl}/api/data/v9.2/RetrieveRecordChangeHistory(Target=@t,PagingInfo=@p)
      ?@t={'@odata.id':'accounts(<id>)'}
      &@p={"PageNumber":1,"Count":20,"ReturnTotalRecordCount":true}
```

Note what the second shape costs that the first does not: the **entity-set
name** (`accounts`, not `account`). A bound call needs only the row's id; an
unbound call with an entity-reference parameter needs `EntitySetName` from
`utils.getEntityMetadata` or the `EntityDefinitions` fetch — one more read and
one more thing a host can withhold. Prefer the bound shape when both exist.

**Headers, and the rule.** Every same-origin fetch of the Web API sends the
same three headers and the same credentials mode, and a control keeps them in
**one helper** so a header is never copied wrong:

```ts
fetch(url, {
    headers: {
        Accept: 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
        // Only when the control reads formatted values or lookup annotations
        // off the answer — it is what puts `@OData.Community.Display.V1.
        // FormattedValue` and `@Microsoft.Dynamics.CRM.lookuplogicalname` on it.
        Prefer: 'odata.include-annotations="*"',
    },
    credentials: 'same-origin',
});
```

No `Content-Type` on a GET. `credentials: 'same-origin'` is what carries the
form's session; a control that forgets it gets a 401 on the form and a green
suite, because the rig never checks. Start from `context.page.getClientUrl()`
(then the `Xrm` global), for the on-premises reason under *The current
record's identity* — and take **one** organisation URL per mount, never one
per pass.

**A binary answer is the exception to the helper.** A File or Image column's
`$value` comes back as `application/octet-stream` with its facts in headers —
`x-ms-file-size`, `mimetype`, and the name in `Content-Disposition` — so the
same helper takes no `Accept: application/json` and no `Prefer` for it, reads
the headers before the body, and lets an answer it will not draw go unread.
Every header is readable: the form is on the same origin, so
`Access-Control-Expose-Headers` is beside the point. *A File or Image column,
through the record* in `files-and-device.md` has the rest.

**A refusal is a named state, not an exception.** `response.ok === false` is
what a user without the privilege gets — a 403 whose body is `{ error: { code,
message } }` — and an offline client rejects the promise with a `TypeError`
before there is a response at all. Both arrive inside the same effect that
draws the list, so both have to end in a sentence the control shows, never in
a thrown error the host swallows. The rig's `auditStatus` switch is those two
shapes (403, and 0 for the `TypeError`).

**Learn can be wrong about a function's answer, and only the form says so.**
*Retrieve the history of audited data changes* states that the Web API's
`AuditDetail` types "don't return the `AuditRecord` navigation property".
Measured on the Accounts form (`pcf-audit-history`, 2026-09-18, P13–P15):
**every `AuditDetail` from both functions carries `AuditRecord`** — the
audit row with `auditid`, `createdon`, `action`, `_userid_value` — and its
formatted values under `Prefer`. The first build of that control was written
on Learn's word: rows from the `audit` table, one request per row for the
values. The probe reversed it into one request per page. Write the probe
before the feature, and put the documented claim in it as a question.

**Audit history, specifically** — measured by `pcf-audit-history`'s probes
on the Accounts form (its `SPEC.md`, P1–P15):

- **One request per page.** `RetrieveRecordChangeHistory(Target=@t,
  PagingInfo=@p)` answers a page of details, each with its `AuditRecord`
  beside its old and new values, `TotalRecordCount`, `MoreRecords` and a
  `PagingCookie`; page 2 by `PageNumber` alone works, and with the cookie
  works, and the order is the audit table's own (newest first). It needs
  `prvReadRecordAuditHistory` and the **entity-set name** — read from
  `utils.getEntityMetadata(table).EntitySetName` (1 ms) or
  `EntityDefinitions(…)?$select=EntitySetName`, never pluralised.
  `RetrieveAttributeChangeHistory(…,AttributeLogicalName=@a,…)` is the same
  for one column, server-side — and it lists the **audit-configuration
  events** filed under the column (action 107 *Audit Enabled*, 105/106
  *Audit Started*) as `AttributeAuditDetail`s with no values.
- **The `audit` table ignores `maxPageSize`.** `retrieveMultipleRecords(
  'audit', …, 5)` answered fifteen rows and `nextLink: ""` — an empty
  string, not `undefined`. Cosmos-backed; it pages only through the
  functions' `PagingInfo`. Read it once, slice it yourself, and keep it as
  the **fallback** for the user with `prvReadAuditSummary` and not
  `prvReadRecordAuditHistory` — rows without values.
- **`Prefer` matters on a function and not on the query.**
  `retrieveMultipleRecords` annotates without being asked;
  `RetrieveAuditDetails` fetched without `Prefer: odata.include-annotations
  ="*"` answers the lookup's guid alone, with it the formatted name,
  `lookuplogicalname` and `associatednavigationproperty`.
- **Three switches say whether there is anything to show**, and the empty
  state names which: `organizations?$select=isauditenabled` (through
  `retrieveMultipleRecords('organization', …)`), then
  `EntityDefinitions(LogicalName='x')?$select=IsAuditEnabled` (a
  `BooleanManagedProperty` — `{ Value, CanBeChanged,
  ManagedPropertyLogicalName }`, read `.Value`), then the column's own on
  `…/Attributes(LogicalName='y')`. *Auditing is off for this environment* is
  a different sentence from *no changes recorded*, and a maker fixes them
  in different places.
- **The value shapes.** A lookup set: `OldValue` holds only `@odata.type`,
  `NewValue` the `_x_value` with its annotations. A column set for the
  first time is on the new side only; cleared is read as the mirror (not yet
  measured). A **money** column arrives as a bare number with **no formatted
  value** and a `_base` shadow beside it — fold the shadow, show the
  number, say so; a decimal arrives formatted. Large values are cut at 5 KB
  with a trailing ellipsis (Learn; not measured). `attributemask` is column
  numbers — do not read it; the columns a change touched are the keys of
  `OldValue` ∪ `NewValue`.
- **The action codes**, when the platform's formatted value is missing: 1
  Create, 2 Update, 3 Delete, 12 Merge, 13 Assign, 41 Set State, 14 Share,
  48 Modify Share, 49 Unshare, 33 Associate, 34 Disassociate, 105–111 the
  audit-configuration events. Prefer `action@…FormattedValue` — localised.
- **A Share or an Associate is not an `AttributeAuditDetail`.** The
  `@odata.type` on the detail says which of five shapes arrived; a differ
  that assumes `OldValue`/`NewValue` on every row renders a share as an
  empty change.
- Audit history is **not available in the mobile app** (Learn), and a canvas
  app has no `webAPI`, no `contextInfo` and no organisation URL to fetch —
  there is no canvas page for this control for that reason.

**And one thing about the binding, found on the way**: on an
`of-type-group` binding, **`parameter.type` names a member of the group,
not the column's type** — `Currency` on a text column. Read
`attributes.Type` when the type matters.

**The rig.** The field rig's fetch stub answers the three functions from
`fixture.audits` — `RetrieveAuditDetails` bound on `audits(<id>)`;
`RetrieveRecordChangeHistory` and `RetrieveAttributeChangeHistory` unbound,
their `@`-aliases parsed off the query string — **every detail with its
`AuditRecord`, annotated only when the request carried `Prefer`**; the
audit table through `retrieveMultipleRecords('audit', …)` answering every
row with `nextLink: ""` whatever `maxPageSize` said; `IsAuditEnabled` and
`EntitySetName` on the table definition; `isauditenabled` on the
organisation; `getEntityMetadata(table, columns).Attributes` as an item
collection with string `DisplayName`s from `fixture.labels` — with
`auditStatus`, `auditSummary` and `auditEnabled: { org, table }` as the
switches, because on a form each of those goes missing on its own.

## Calling a Web API action

An **action** is the POST half of the Web API's messages — a custom API, a
Custom Process Action, a platform message like `GrantAccess` — and
`context.webAPI` cannot make one either. It is one same-origin `fetch` away,
like a function, and `pcf-hierarchy-view`'s 0.2.9 probe measured every part of
it on the account form (2026-10-15), against a throwaway Custom API with no
plug-in: an unbound `pcfhub_ProbeEcho` (a string in, a string out) and an
account-bound twin, created and deleted from the console the same minute.
Its SPEC.md has the answers line by line.

**Before reaching for one, ask whether the work belongs in a control.** An
action that changes data runs as the user, from the browser, with no
transaction around anything the control did before or after it; the
platform's own guidance for "a control must change data through a message"
is still a plug-in behind the action or a flow, with the control only
pressing the button. That is a design question — this section is how the
call itself behaves once the answer is yes.

**The two URL shapes**, as for a function — but the bound one is not
optional about its namespace:

```
POST {clientUrl}/api/data/v9.2/pcfhub_ProbeEcho                                              unbound
POST {clientUrl}/api/data/v9.2/accounts(<id>)/Microsoft.Dynamics.CRM.pcfhub_ProbeEchoAccount  bound
```

The parameters go in the **body**, as JSON named by the parameters' unique
names — `{"Text":"…"}` — not as `@`-aliases. A bound action written without
`Microsoft.Dynamics.CRM.` is a **404** (*Resource not found for the
segment*), and so is a bound action called unbound. An entity-reference
parameter in the body is `{"@odata.type":"Microsoft.Dynamics.CRM.account",
"accountid":"<id>"}` by the Web API's rules — not measured here.

**Headers: `Content-Type` is the one that matters.**

- Without `Content-Type: application/json` the server answers **415**
  `0x80060888` *POST request requires Content-Type application/json.* — before
  it looks at anything else.
- `OData-MaxVersion`/`OData-Version` are **not** required (a POST with only
  `Content-Type` answered 200). Send them anyway through the one helper the
  function calls use, and add `Content-Type` there for a POST.
- **The session cookie is the whole of authentication.** No token, no CSRF
  header: `credentials: 'same-origin'` (the default) works; `credentials:
  'omit'` is a **401 with an empty body**, after 4.7 s — so read the status
  before `.json()`, which throws on it.

**The answer.** **200** with the response properties beside an
`@odata.context` naming the response type:

```json
{ "@odata.context": "…/api/data/v9.2/$metadata#Microsoft.Dynamics.CRM.pcfhub_ProbeEchoResponse", "Echo": null }
```

A Custom API with no plug-in **runs and answers its properties `null`** — it
is not refused — so a `200` says the message was accepted, not that anything
happened. One with no response properties at all likely answers 204; not
measured. A no-plug-in bound action **did not touch its record**
(`modifiedon` and `versionnumber` the same before and after): whatever an
action changes is its plug-in's doing, and the control re-reads what it shows
afterwards rather than assuming.

**The refusals come in two families:**

| Sent | Answer |
| --- | --- |
| A required parameter left out | 400 `0x80048d19` — *…The missing parameters are: Text.* |
| A value of the wrong type (`5` for a string) | 400 `0x80048d19` — *Cannot convert the literal '5' to the expected type 'Edm.String'.* |
| A parameter the action does not take | 400 `0x80048d19` — *The parameter 'Nope' in the request payload is not a valid parameter…* |
| A body that is not JSON | 400 `0x80048d19` — *Stream was not readable.* |
| A name the environment does not have, or an unqualified bound name | 404 `0x80060888` — *Resource not found for the segment '…'* |
| A GET on an action | 404 with **`code: ""`** — *No HTTP resource was found that matches the request URI…* |
| No `Content-Type` | 415 `0x80060888` |
| No session (`credentials: 'omit'`) | 401, empty body |

Every 400's `message` opens *Error identified in Payload provided by the user
for Entity :''…* and carries the server's .NET stack — 1.5 to 3.4 KB. Show the
user the first sentence after `InnerException :`, never the whole message,
and keep the code for the console. Offline is the `TypeError` `fetch` always
rejects with, as for a function.

**Creating the Custom API to test against** is itself one POST: `customapis`
with `CustomAPIRequestParameters` and `CustomAPIResponseProperties`
deep-inserted (`type: 10` is String; `bindingtype` 0 global, 1 entity with
`boundentitylogicalname`; `isfunction: false`;
`allowedcustomprocessingsteptype: 0`) answered 204 in 2–7 s, with no
`MSCRM.SolutionUniqueName` needed for a name carrying an existing publisher's
prefix. `DELETE customapis(<id>)` removes the parameters and properties with
it. A probe that needs an action creates its own and deletes it — never one
somebody else's flow depends on.

**A bound Custom API cannot take a parameter named `Target`** — 400
`0x80048d0b` *Custom API bound to an entity cannot use the reserved name
'Target' as the name of a Custom API Request Parameter* (2026-10-28). The bound
record already is its `Target`; name the others anything else, and tell makers
so, because "Target" is what they reach for.

**For a flow to hear it**, Power Automate's *When an action is performed* lists
only actions in a **catalog**: a `catalogs` row, a second one under it as the
category (`ParentCatalogId@odata.bind`), and a `catalogassignments` row linking
the category to the API (`CatalogId@odata.bind`, `CustomAPIId@odata.bind`) —
each one POST. Learn says the API should allow asynchronous steps.

**What the flow then gets** — measured from a form button,
`pcf-form-action-button` W1, 2026-10-28:

- Turning the flow on writes one `callbackregistrations` row (`entityname`,
  `sdkmessagename`, `scope` 4, `version` 3); the designer's *(none)* table for
  an unbound action is `entityname` **`none`**. That row is how a probe checks
  the subscription took before pressing anything.
- The trigger body is `InputParameters` — each parameter by its name, a
  reference as `{Id, LogicalName, Name: null, KeyAttributes: [], RowVersion:
  null}` — plus, on a **bound** action, **`InputParameters.Target`**, the bound
  record (the platform's own use of the reserved name), and `ItemInternalId`,
  its id. Then `OutputParameters` (`{}` with no response properties),
  `SdkMessage`, and `RunAsSystemUserId`, the caller. Unbound has no `Target`
  and no `ItemInternalId`.
- In expressions: `triggerBody()?['InputParameters']?['<Name>']`, or
  `triggerOutputs()?['body/InputParameters/<Name>']` — both read back right.
- **The call does not wait for the flow.** 204 in 0.3–0.6 s; the run started
  0.4–5.1 s after the answer, on the server's clock. A control that calls such
  an action can say only that it was sent; a form refresh on its answer shows a
  plug-in's writes, never the flow's.
- A flow can be made without the portal: `POST
  https://api.flow.microsoft.com/providers/Microsoft.ProcessSimple/environments/<env>/flows?api-version=2016-11-01`
  with a token for `https://service.flow.microsoft.com/`, the trigger
  `OpenApiConnectionWebhook` / `BusinessEventsTrigger` with parameters
  `catalog`, `category`, `subscriptionRequest/entityname`,
  `subscriptionRequest/sdkmessagename`, and an existing Dataverse connection
  (listed from `api.powerapps.com`, `apis/shared_commondataserviceforapps/connections`)
  in `connectionReferences`. Runs and their trigger outputs are `GET
  …/flows/<id>/runs`. This is how a probe measures a flow when the portal will
  not load in an automated browser.

### From a row: what a command on a dataset control adds

`pcf-row-commands`' 0.3.4 probe asked the rest from a **dataset** control on a
form's subgrid and on a main grid (2026-10-16, its SPEC.md P1–P6), with three
throwaway no-plug-in Custom APIs:

- **The address comes from metadata the control already reads.**
  `page.getClientUrl()` answers on both hosts; `getEntityMetadata(table)`
  gives `EntitySetName` and `PrimaryIdAttribute` (`cll_accounts`/
  `cll_accountid` on the subgrid, `accounts`/`accountid` on the main grid),
  the same as `EntityDefinitions(LogicalName='…')?$select=EntitySetName,
  PrimaryIdAttribute`. A bound call from the control answered 200 in 76 ms on
  the subgrid, 272–370 ms on the main grid — the cookie the only credential.
- **The name is case-sensitive**, and the 404 names the segment it could not
  resolve, in two spellings: a qualified bound one *'Microsoft.Dynamics.CRM.
  <name>'* with **no** full stop (an unknown name, another case, or a bound
  action on another table's set), an unbound one or a bound action called
  unbound *'<name>'.* **with** one. Match on the name to tell a maker "check
  the name, and whether it is bound".
- **An `EntityReference` parameter needs its `@odata.type`**:
  `{"@odata.type": "Microsoft.Dynamics.CRM.<table>", "<id column>": "<id>"}`.
  Without it, 400 `0x80048d19` *Invalid property '<id column>' was found in
  entity 'Microsoft.Dynamics.CRM.crmbaseentity'*. **With the wrong table it is
  accepted** (204) — nothing checks an unconstrained reference — so build it
  from the row's own table rather than let anyone spell it. An `Edm.Guid` that
  is not one is a 400 *Cannot convert the literal …*; braces are accepted.
- **An action with no response properties answers 204**, empty.
- **The platform's own refusal is short and whole** — `GrantAccess` to a user
  that does not exist: 404 `0x80040217`, 81 characters, *Entity 'systemuser'
  With Id = … Does Not Exist*, no *InnerException* — where the payload family
  is 1.5–3.6 KB with the stack. A value that is no member of an enum parameter
  is a **500** `0x0` *Requested value '…' was not found.* Show the user the
  sentence after *InnerException :* when there is one, else the message whole —
  and put it on the error dialog's **message**: its `details` are never shown
  ([The dialogs, and the cancel that arrives as a resolve](navigation-and-events.md#the-dialogs-and-the-cancel-that-arrives-as-a-resolve)).
- **A no-plug-in bound action on an id that is no row answers 200.** Nothing
  checks the row; a record deleted while the page showed it is not refused.
  Refresh after every call and let the rows say what changed.
- **Five calls in sequence: 79–235 ms each, 734 ms in all, nothing
  throttled**, and the platform kept the selection through the refresh.

### From a form: a button on the record

`pcf-form-action-button` 0.1.9's probe asked the same from a **field** control
on the account form (2026-10-28, its SPEC.md P1–P8, then the 0.2.x
walkthrough), with two throwaway no-plug-in Custom APIs, *Allowed custom
processing step type* Async only:

- **The record is `mode.contextInfo`** — `entityTypeName` and the bare
  lower-case `entityId` on a saved record; on a new one `entityId` is
  **`null`**, present. **After the first save the same instance gets the id**,
  on a later `updateView`, with no `destroy` and no second `init` — so a button
  that needs the record can say *Save the record first* and come on by itself.
- **`getEntityMetadata(table)` works from a field control** — `EntitySetName`,
  `PrimaryIdAttribute` in 0–1 ms (the form has it cached) — and
  `page.getClientUrl()` answers. Both are the same as from a dataset control.
- **A bound call answered 204 in 411 ms, unbound 206 ms**; a real platform
  message with a response (`InitializeFileBlocksDownload`, unbound, `Target`
  `{record}`) answered 200 with `FileName`. The cookie is the only credential,
  as everywhere else.
- **The call sees the saved record.** Nothing the user typed and did not save
  is part of it. A control cannot save the form, so say so, and let a form
  script stop the press while the form is dirty.
- **After a write behind the action, the form is stale.** From an
  `addOnOutputChange` handler, `formContext.data.refresh(false)` showed a
  server-side write in 251 ms, the form clean and the control **not** remounted.
  A control cannot call it; document it as the maker's snippet, keyed on an
  output that says the call succeeded.

`_template`'s **`lib/web-api-action`** is all of this as shared code —
`callAction`, the refusal reading, `loadRecordKeys` (metadata, then
`EntityDefinitions`), `organisationUrl` — adopted by making the folder; both
`pcf-row-commands` (0.4.3) and `pcf-form-action-button` (0.2.0) use it.

**The rig.** Both rigs answer an action from `fixture.actions` — the field rig
since 2026-10-15, the dataset rig since 2026-10-16; an older field rig takes the
stub by copying `actionAnswer` and its three reply helpers verbatim, as
`pcf-form-action-button`'s `dev/host.js` did — `{ <name>: { boundTo?,
parameters: { <name>: { type, optional? } }, response: [...], answer(params,
id), refuse(params, id)? } }`, with every refusal above in the server's order
(the two 404 spellings, the `Edm.Guid` and untyped-reference 400s, 204 for no
response), `refuse` returning `{ status, code, message }` for an action's own
refusal, and `actionStatus` (`0` offline) for the rest. The `answer` is handed
the parameters and the bound id, never the row, because the measured action
left the row alone. A parameter typed `Microsoft.Dynamics.CRM.crmbaseentity` is
an EntityReference. The dataset rig resolves a bound set the way the server
does: `entitySets`, the view's own table, or a `related` one.
