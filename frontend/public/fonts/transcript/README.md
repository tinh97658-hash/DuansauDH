# Transcript PDF fonts

## Active font: Liberation Serif 2.1.5

Regular, Bold, Italic and BoldItalic are the unmodified TTF files from the
official Liberation Fonts 2.1.5 release:

https://github.com/liberationfonts/liberation-fonts/releases/tag/2.1.5

Binary source archive:
https://github.com/liberationfonts/liberation-fonts/files/7261482/liberation-fonts-ttf-2.1.5.tar.gz

Redistributed under SIL Open Font License 1.1. The upstream copyright notices
and full license are preserved in `LIBERATION-LICENSE.txt`. That license permits
bundling and embedding with software; the fonts are not sold separately.

Liberation Serif was selected after comparison with Noto Serif, Tinos 1.340 and
the supplied Times New Roman reference. All four faces cover the required
Vietnamese text and U+1EA0..U+1EF9. The assets have not been renamed, subsetted or
modified. No proprietary Times New Roman font is included.

Only PDF exports load Liberation Serif. DOCX keeps its existing font settings.
The PDF font adapter uses the source font's ascent/descent to retain the existing
point line heights and baselines; document layout constants are unchanged.

## Previous font: Noto Serif

Noto Serif Regular, Bold, Italic, BoldItalic, from the official archived repository:
https://github.com/notofonts/noto-fonts/tree/main/hinted/ttf/NotoSerif

The earlier Noto files and `OFL.txt` are local comparison artifacts excluded
from Git. They are not required to build or run the application; the active
PDF renderer loads only the four bundled Liberation Serif faces.
