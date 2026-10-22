#!/usr/bin/env node
/**
 * Check that every pointer into a skill's `references/` still lands somewhere,
 * and that no skill outgrows the promise its `SKILL.md` makes about them.
 *
 *   node scripts/check-references.mjs
 *   node scripts/check-references.mjs --scan ../pcf-components
 *
 * The skills route by pointer. A `SKILL.md` names a file and often a section
 * of it — "*The demo block* in `references/hub-demo.md`" — and so do the
 * references themselves, and so do the `SPEC.md` files of every control built
 * with the plugin. A section that moves without its pointers is a route that
 * ends in nothing, and nothing says so: the reader opens the file, does not
 * find the heading, and either searches or gives up. Splitting a file is the
 * moment that happens most, so this runs after every split.
 *
 * **Five skills, one set of names.** The plugin was one skill until
 * 2026-10-21, and the control repositories' pointers say `references/x.md`
 * with no skill in them. So a reference's file name is unique across every
 * skill — a duplicate is a failure — and a pointer resolves like this:
 *
 *   - `references/x.md`, or a bare `x.md`, from inside a skill is that skill's
 *     own. A file that lives in a sibling skill is named with it:
 *     `pcfhub-publish/references/x.md`, which reads the same from any skill
 *     because the skills sit side by side under `skills/`.
 *   - from anywhere else — the README, a scanned `SPEC.md` — `references/x.md`
 *     (or the old `skills/pcfhub-controls/references/x.md`) is whichever skill
 *     holds a file by that name.
 *   - a Markdown link is a path, resolved from the file it is in, and may
 *     point at a `SKILL.md` as well as a reference.
 *
 * Two kinds of pointer, both checked:
 *
 *   - **a Markdown link** to a `.md` file in the plugin, with or without a
 *     `#anchor`. The file must exist, and the anchor must be the slug of a
 *     heading in it, made the way GitHub makes them.
 *   - **a prose pointer**, `*Title* in \`references/x.md\`` (or `in x.md`, or
 *     `in the skill's references/x.md`), wrapped across lines or not. The
 *     title must name a heading in that file — or the bold lead-in of a
 *     paragraph or list item, which is how the skills name a rule inside a
 *     section. A title may stop at a clause boundary ("*The current record's
 *     identity*" for "…identity, from a field control"), and one ending in `…`
 *     names a prefix.
 *
 * A file over 700 lines is a warning, not a failure: "small enough to read
 * whole" is a judgement. The 2 Oct 2026 split drew the line at 900; by 15 Oct
 * seven files sat between 699 and 796 under it, and splitting them left the
 * largest at 663, so the line moved down to where the files now are. A
 * `SKILL.md` warns past 500: it is read on every trigger, and 500 is the
 * ceiling skill authoring guidance sets for the file that routes.
 *
 * **Every skill's frontmatter is read too**: `name` has to be the folder's
 * name, and `description` at most 1,024 characters — the limit the Agent
 * Skills format sets, which the single skill's description had come within
 * twenty characters of.
 *
 * `--scan <dir>` also reads every Markdown file under `<dir>` (skipping
 * `node_modules`, `.git`, `out`, `bin`, `obj`) for prose pointers that say
 * `references/` or "the skill's" — the `SPEC.md` and `media/README.md`
 * pointers the control repositories carry. A bare `limitations.md` there is
 * the control's own docs page, so it is not read as a pointer, and links there
 * are not checked: they point at the skill's published copy.
 *
 * **Every reference is routed to.** A reference its skill's *Where the detail
 * is* never names is one no step sends a reader to — a split that adds a file
 * and forgets the table leaves half a topic unreachable from the top. Each
 * `references/*.md` must appear in that section of its own skill's `SKILL.md`
 * (the table and the paragraph under it) unless it is an index left by a
 * split, whose title says "— index". A miss is a failure.
 *
 * Prints how many pointers it checked, because a clean run over zero pointers
 * proves nothing. Exits 1 when any pointer fails. No dependencies.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skillsDir = join(pluginRoot, 'skills');
const LINE_LIMIT = 700;
const SKILL_LINE_LIMIT = 500;
const DESCRIPTION_LIMIT = 1024;
const SKIP_DIRS = new Set(['node_modules', '.git', 'out', 'bin', 'obj', 'generated']);

const args = process.argv.slice(2);
const scanAt = args.indexOf('--scan');
const scanDirs = scanAt === -1 ? [] : args.slice(scanAt + 1).filter((a) => !a.startsWith('--'));

if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: check-references.mjs [--scan <dir> …]');
    process.exit(0);
}

/** GitHub's heading slug: lower case, punctuation gone, spaces to hyphens. */
function slug(text) {
    return text
        .trim()
        .toLowerCase()
        .replace(/<[^>]+>/g, '')
        .replace(/[^\p{L}\p{N}\s_-]/gu, '')
        .replace(/\s/g, '-');
}

/** A title as a reader compares it: no backticks, no emphasis, one space. */
function normalise(text) {
    return text
        .replace(/`/g, '')
        .replace(/\*\*/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .replace(/[.:]$/, '')
        .trim()
        .toLowerCase();
}

/**
 * The text with every fenced code block blanked line for line, so a match's
 * offset still converts to the right line number and nothing inside a fence
 * is read as a heading or a pointer.
 */
function prose(text) {
    let fenced = false;

    return text
        .split(/\r?\n/)
        .map((line) => {
            if (/^\s*(```|~~~)/.test(line)) {
                fenced = !fenced;
                return '';
            }

            return fenced ? '' : line;
        })
        .join('\n');
}

/**
 * Whether `index` falls inside an inline code span: an odd number of
 * backticks between the start of its line and it. A pointer written as an
 * example — `*Title* in references/x.md` — is not a pointer.
 */
function insideCode(text, index) {
    const start = text.lastIndexOf('\n', index - 1) + 1;

    return (text.slice(start, index).match(/`/g) ?? []).length % 2 === 1;
}

function lineAt(text, index) {
    let line = 1;

    for (let i = 0; i < index; i += 1) {
        if (text.charCodeAt(i) === 10) {
            line += 1;
        }
    }

    return line;
}

function lineCount(text) {
    return text.split(/\r?\n/).length - (text.endsWith('\n') ? 1 : 0);
}

const failures = [];
const warnings = [];
let pointers = 0;

// The skills, and every reference by its file name. A name two skills share
// is a failure, because a pointer from outside the plugin names only the file.
const skills = readdirSync(skillsDir)
    .filter((name) => existsSync(join(skillsDir, name, 'SKILL.md')))
    .sort();
const byName = new Map();

for (const skill of skills) {
    const dir = join(skillsDir, skill, 'references');

    for (const name of existsSync(dir) ? readdirSync(dir).filter((n) => n.endsWith('.md')) : []) {
        const path = join(dir, name);

        if (byName.has(name)) {
            failures.push(`${name} is in both ${relative(pluginRoot, byName.get(name))} and ${relative(pluginRoot, path)} — a pointer from outside the plugin names the file alone`);
        } else {
            byName.set(name, path);
        }
    }
}

/** The skill a path sits in, or `null` for the README and scanned files. */
function skillOf(path) {
    const rel = relative(skillsDir, path);

    return rel.startsWith('..') || rel === '' ? null : rel.split(sep)[0];
}

const targets = new Map();

/** Every heading's anchor and title in `text`, which `prose()` has cleaned. */
function headingsOf(text) {
    const anchors = new Set();
    const titles = [];
    const seen = new Map();

    for (const line of text.split('\n')) {
        const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);

        if (heading) {
            const base = slug(heading[2]);
            const count = seen.get(base) ?? 0;

            seen.set(base, count + 1);
            anchors.add(count === 0 ? base : `${base}-${count}`);
            titles.push(normalise(heading[2]));
        }
    }

    return { anchors, titles };
}

/** What a Markdown file offers a pointer: its anchors and its titles. */
function targetsOf(path) {
    if (targets.has(path)) {
        return targets.get(path);
    }

    if (!existsSync(path)) {
        targets.set(path, null);
        return null;
    }

    const text = prose(readFileSync(path, 'utf8'));
    const { anchors, titles } = headingsOf(text);

    // A bold lead-in: `**Title.** text` opening a paragraph or a list item,
    // wrapped or not. The skills name rules inside a section this way, and
    // their prose pointers name them back.
    for (const paragraph of text.split(/\n\s*\n/)) {
        for (const item of paragraph.split(/\n(?=\s*(?:[-*]|\d+\.)\s)/)) {
            const lead = /^\s*(?:(?:[-*]|\d+\.)\s+(?:\[[ x]\]\s+)?)?\*\*([\s\S]+?)\*\*([\s\S]*)$/.exec(item);

            if (!lead) {
                continue;
            }

            titles.push(normalise(lead[1]));

            // An index line — `- **Section** — Sub · Sub · Sub`, the shape a
            // split leaves behind to map old titles — names each sub too.
            const subs = /^\s*—\s+([\s\S]+)$/.exec(lead[2]);

            if (subs) {
                for (const sub of subs[1].split(' · ')) {
                    titles.push(normalise(sub));
                }
            }
        }
    }

    const result = { anchors, titles };

    targets.set(path, result);

    return result;
}

function titleResolves(found, title) {
    const wanted = normalise(title);

    if (/(…|\.\.\.)$/.test(wanted)) {
        const prefix = wanted.replace(/(…|\.\.\.)$/, '').trim();

        return found.titles.some((t) => t.startsWith(prefix));
    }

    // Whole, or up to a clause boundary: the next character is not part of a
    // word, so "the caret" does not resolve against "the careted".
    return found.titles.some((t) => t === wanted || (t.startsWith(wanted) && /^[^\p{L}\p{N}]/u.test(t.slice(wanted.length))));
}

/**
 * Where a prose pointer lands. `folder` is what came before the file name —
 * `references/`, `pcfhub-publish/references/`, `skills/x/references/` or
 * nothing — and `fromSkill` the skill the pointer is written in, if any.
 * Returns the path, or the reason there is none.
 */
function resolvePointer(file, folder, fromSkill, theSkills) {
    const named = /^(?:skills\/)?([a-z0-9-]+)\/references\/$/.exec(folder ?? '');
    const home = byName.has(file) ? skillOf(byName.get(file)) : null;

    // `skills/pcfhub-controls/` is the one skill there used to be: a pointer
    // that names it means "the plugin", and lands by file name.
    if (named && named[1] !== 'pcfhub-controls') {
        if (!skills.includes(named[1])) {
            return { reason: `no skill called ${named[1]}` };
        }

        const path = join(skillsDir, named[1], 'references', file);

        return existsSync(path) ? { path } : { reason: `no ${file} in ${named[1]}${home ? ` — it is in ${home}` : ''}` };
    }

    if (fromSkill !== null && !named && !theSkills) {
        const path = join(skillsDir, fromSkill, 'references', file);

        if (existsSync(path)) {
            return { path };
        }

        return { reason: home ? `not in ${fromSkill} — it is in ${home}; name it \`${home}/references/${file}\`` : 'no such reference file' };
    }

    return home ? { path: byName.get(file) } : { reason: 'no such reference file' };
}

/**
 * The prose pointer. The title may hold backticks of its own
 * (`*What `npm run check` covers*`) and may wrap, but not across a blank line,
 * and a single asterisk followed by a space is a list bullet, not a title.
 */
const PROSE = /(?<![*\w])\*(?![*\s])((?:[^*\n]|\n(?![ \t]*\n)){1,200}?)\*(?!\*),?\s+in\s+(the\s+(?:skill|plugin)'s\s+)?`?((?:skills\/)?(?:[a-z0-9-]+\/)?references\/)?([a-z0-9-]+\.md)`?/g;

/**
 * The same pointer written file first, as the control repositories often do:
 * `references/x.md`, under *Title* — or `references/x.md`, "Title". Only with
 * the folder spelled out, so it cannot mistake a docs page for a reference.
 */
const FILE_FIRST = /`?((?:skills\/)?(?:[a-z0-9-]+\/)?references\/)([a-z0-9-]+\.md)`?,?\s+(?:under\s+\*(?![*\s])((?:[^*\n]|\n(?![ \t]*\n)){1,200}?)\*(?!\*)|"([^"\n]{1,200})")/g;

/** A relative link to a Markdown file — a reference or a `SKILL.md`. */
const LINK = /\]\(((?!https?:|mailto:|#|\/)[^)\s#]+\.md)(?:#([^)\s]+))?\)/gi;

/**
 * @param {string} path
 * @param {{ links: boolean, explicitOnly: boolean }} options `explicitOnly`
 *   for files outside the plugin: there only a pointer that says `references/`
 *   or "the skill's" is a pointer into it.
 */
function checkFile(path, { links, explicitOnly }) {
    const text = prose(readFileSync(path, 'utf8'));
    const where = relative(process.cwd(), path) || path;
    const fromSkill = skillOf(path);

    const found = [];

    for (const match of text.matchAll(PROSE)) {
        const [, title, theSkills, folder, file] = match;

        if ((!explicitOnly || theSkills || folder) && !insideCode(text, match.index)) {
            found.push({ index: match.index, title, folder, file, theSkills });
        }
    }

    for (const match of text.matchAll(FILE_FIRST)) {
        const [, folder, file, starred, quoted] = match;

        // The match starts at the file name's own opening backtick, so the
        // count before it is even unless the whole pointer sits in a span.
        if (!insideCode(text, match.index)) {
            found.push({ index: match.index, title: starred ?? quoted, folder, file });
        }
    }

    for (const { index, title, folder, file, theSkills } of found) {
        pointers += 1;

        const at = `${where}:${lineAt(text, index)}`;
        const shown = `*${title.replace(/\s+/g, ' ')}* in ${folder ?? ''}${file}`;
        const landed = resolvePointer(file, folder, fromSkill, theSkills);

        if (landed.reason) {
            failures.push(`${at}  ${shown} — ${landed.reason}`);
        } else if (!titleResolves(targetsOf(landed.path), title)) {
            failures.push(`${at}  ${shown} — no heading or bold lead-in by that name`);
        }
    }

    if (!links) {
        return;
    }

    // `](#anchor)` — a table of contents, or a pointer within the file. The
    // first thing a split breaks, because the heading left and the link
    // stayed.
    const own = headingsOf(text).anchors;

    for (const match of text.matchAll(/\]\(#([^)\s]+)\)/g)) {
        pointers += 1;

        if (!own.has(decodeURIComponent(match[1]))) {
            failures.push(`${where}:${lineAt(text, match.index)}  link to #${match[1]} — no heading with that anchor in this file`);
        }
    }

    for (const match of text.matchAll(LINK)) {
        const [, target, anchor] = match;
        const linked = resolve(dirname(path), decodeURIComponent(target));

        // Only links into the plugin's own Markdown are this script's to check.
        if (relative(pluginRoot, linked).startsWith('..')) {
            continue;
        }

        pointers += 1;

        const at = `${where}:${lineAt(text, match.index)}`;
        const linkedTargets = targetsOf(linked);

        if (linkedTargets === null) {
            const moved = byName.get(basename(linked));
            const hint = moved ? ` — it is ${relative(dirname(path), moved).split(sep).join('/')}` : '';

            failures.push(`${at}  link to ${target} — no such file${hint}`);
        } else if (anchor !== undefined && !linkedTargets.anchors.has(decodeURIComponent(anchor))) {
            failures.push(`${at}  link to ${target}#${anchor} — no heading with that anchor`);
        }
    }
}

/** A frontmatter field's value, unquoted, or `null` when there is none. */
function frontmatter(text, key) {
    const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
    const value = front && new RegExp(`^${key}:\\s*(.*)$`, 'm').exec(front[1]);

    return value ? value[1].trim().replace(/^"([\s\S]*)"$/, '$1').replace(/\\"/g, '"') : null;
}

let checked = 0;

for (const skill of skills) {
    const skillMd = join(skillsDir, skill, 'SKILL.md');
    const referencesDir = join(skillsDir, skill, 'references');
    const referenceNames = existsSync(referencesDir) ? readdirSync(referencesDir).filter((n) => n.endsWith('.md')) : [];
    const skillText = readFileSync(skillMd, 'utf8');

    for (const path of [skillMd, ...referenceNames.map((name) => join(referencesDir, name))]) {
        checkFile(path, { links: true, explicitOnly: false });
        checked += 1;
    }

    const name = frontmatter(skillText, 'name');
    const description = frontmatter(skillText, 'description');

    if (name !== skill) {
        failures.push(`skills/${skill}/SKILL.md names itself ${name === null ? 'nothing' : `"${name}"`} — the name has to be the folder's`);
    }

    if (!description) {
        failures.push(`skills/${skill}/SKILL.md has no description — nothing tells an assistant when to read it`);
    } else if (description.length > DESCRIPTION_LIMIT) {
        failures.push(`skills/${skill}/SKILL.md's description is ${description.length} characters — past ${DESCRIPTION_LIMIT}`);
    }

    if (lineCount(skillText) > SKILL_LINE_LIMIT) {
        warnings.push(`skills/${skill}/SKILL.md is ${lineCount(skillText)} lines — past ${SKILL_LINE_LIMIT}; move detail into the reference the step names`);
    }

    // A reference counts as routed only when its own skill names it: a
    // sibling's `pcfhub-publish/references/x.md` in the table is a pointer
    // across, not this skill routing to one of its own.
    const at = skillText.indexOf('\n## Where the detail is');
    const end = at === -1 ? -1 : skillText.indexOf('\n## ', at + 1);
    const section = at === -1 ? '' : skillText.slice(at, end === -1 ? undefined : end);
    const routed = new Set([...section.matchAll(/(?<![a-z0-9-]\/)references\/([a-z0-9-]+\.md)/g)].map((m) => m[1]));

    if (referenceNames.length > 0 && at === -1) {
        failures.push(`skills/${skill}/SKILL.md has no "## Where the detail is" section to route its references from`);
    }

    for (const ref of referenceNames) {
        const text = readFileSync(join(referencesDir, ref), 'utf8');
        const title = (text.match(/^# (.*)$/m) || [])[1] || '';

        if (!routed.has(ref) && !/— index$/.test(title.trim())) {
            failures.push(`skills/${skill}/references/${ref} is not named under its SKILL.md's "Where the detail is" — no step routes a reader to it`);
        }

        if (lineCount(text) > LINE_LIMIT) {
            warnings.push(`skills/${skill}/references/${ref} is ${lineCount(text)} lines — past ${LINE_LIMIT}, a candidate to split along a topic seam`);
        }
    }
}

const readme = join(pluginRoot, 'README.md');

if (existsSync(readme)) {
    checkFile(readme, { links: true, explicitOnly: true });
    checked += 1;
}

function walk(dir, out) {
    for (const entry of readdirSync(dir)) {
        if (SKIP_DIRS.has(entry)) {
            continue;
        }

        const path = join(dir, entry);

        if (statSync(path).isDirectory()) {
            walk(path, out);
        } else if (entry.endsWith('.md')) {
            out.push(path);
        }
    }

    return out;
}

let scanned = 0;

for (const dir of scanDirs) {
    for (const path of walk(resolve(dir), [])) {
        if (!relative(pluginRoot, path).startsWith('..')) {
            continue;
        }

        scanned += 1;
        checkFile(path, { links: false, explicitOnly: true });
    }
}

for (const warning of warnings) {
    console.log(`warn  ${warning}`);
}

for (const failure of failures) {
    console.log(`FAIL  ${failure}`);
}

console.log(
    `${failures.length === 0 ? 'ok' : 'failed'}: ${pointers} pointer(s) in ${checked} file(s) across ${skills.length} skill(s)`
    + (scanDirs.length ? ` and ${scanned} scanned file(s)` : '')
    + ` — ${failures.length} broken, ${warnings.length} warning(s)`,
);

process.exit(failures.length === 0 ? 0 : 1);
