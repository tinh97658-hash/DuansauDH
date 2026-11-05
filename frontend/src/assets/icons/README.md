Application icons use Heroicons 2.2.0 through `src/components/AppIcons.jsx`.
This preserves MUI sizing, colours, refs, and `sx` styles while using Heroicons artwork.

`hero-chevron-down.svg` is rendered from the installed Heroicons 2.2.0
`ChevronDownIcon` for CSS backgrounds on native select controls. Only the stroke
colour is set to the existing muted text colour.
See `HEROICONS-LICENSE.txt` for its MIT license.

The following retained legacy SVG assets are Bootstrap Icons v1.11.3, licensed under MIT.

Source: https://github.com/twbs/icons/tree/v1.11.3/icons

- `filetype-docx.svg`
- `filetype-xlsx.svg`
- `filetype-pdf.svg`

The original paths are unchanged. The document export menu now uses Heroicons.
See `BOOTSTRAP-ICONS-LICENSE.txt` for the upstream copyright and license.
