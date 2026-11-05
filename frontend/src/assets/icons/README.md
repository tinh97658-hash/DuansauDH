Application icons use Heroicons 2.2.0 through `src/components/AppIcons.jsx`.
This preserves MUI sizing, colours, refs, and `sx` styles while using Heroicons artwork.

Icon foregrounds use the `--icon-*` tokens in `src/index.css`. Use primary for
actions, neutral/muted for utilities, success/warning/danger for status, and the
remaining dark accents for navigation categories. Active foreground tokens have
at least 7:1 contrast against the standard light surfaces (including table headers
and navigation icon tints). Icons inside solid buttons inherit the button's text
colour; do not apply a dark foreground token on a solid background.

`hero-chevron-down.svg` and `hero-chevron-up.svg` are rendered from the installed
Heroicons 2.2.0 `ChevronDownIcon` and `ChevronUpIcon` for CSS backgrounds on native
select controls. Shared dropdown sizing and spacing live in `styles/dropdowns.css`
and use the `--dropdown-*` tokens in `index.css`. Only the stroke
colour is set to the shared muted icon colour (`#354959`).
See `HEROICONS-LICENSE.txt` for its MIT license.
