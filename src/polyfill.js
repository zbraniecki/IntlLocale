/**
 * 1) Introduce a global `Locale` object with a set of static methods
 * that allow to operate on language tags and negotiate locales
 *
 * Initially expose three functions that are currently inside Intl
 *
 *   - CanonicalizeLocaleList
 *   - ResolveLocale
 *   - SupportedLocales
 *
 * And introduce a new function:
 * 
 *   - PrioritizeAvailableLocales
 *
 * Future extensions:
 * - Operations on LangugageTag
 * - Language Tag comparators
 **/

const unicodeLocaleExtensionSequence = '-u(-[a-z0-9]{2,8})+';
const unicodeLocaleExtensionSequenceRE = new RegExp(unicodeLocaleExtensionSequence);
const unicodeLocaleExtensionSequenceGlobalRE = new RegExp(unicodeLocaleExtensionSequence, 'g');
const langTagMappings = {};
const langSubtagMappings = {};
const extlangMappings = {};

/**
 * Regular expression defining BCP 47 language tags.
 *
 * Spec: RFC 5646 section 2.1.
 */
const languageTagRE = (function () {
  // RFC 5234 section B.1
  // ALPHA          =  %x41-5A / %x61-7A   ; A-Z / a-z
  const ALPHA = '[a-zA-Z]';
  // DIGIT          =  %x30-39
  //                        ; 0-9
  const DIGIT = '[0-9]';

  // RFC 5646 section 2.1
  // alphanum      = (ALPHA / DIGIT)     ; letters and numbers
  const alphanum = '(?:' + ALPHA + '|' + DIGIT + ')';
  // regular       = 'art-lojban'        ; these tags match the 'langtag'
  //               / 'cel-gaulish'       ; production, but their subtags
  //               / 'no-bok'            ; are not extended language
  //               / 'no-nyn'            ; or variant subtags: their meaning
  //               / 'zh-guoyu'          ; is defined by their registration
  //               / 'zh-hakka'          ; and all of these are deprecated
  //               / 'zh-min'            ; in favor of a more modern
  //               / 'zh-min-nan'        ; subtag or sequence of subtags
  //               / 'zh-xiang'
  const regular = '(?:art-lojban|cel-gaulish|no-bok|no-nyn|zh-guoyu|zh-hakka|zh-min|zh-min-nan|zh-xiang)';
  // irregular     = 'en-GB-oed'         ; irregular tags do not match
  //                / 'i-ami'             ; the 'langtag' production and
  //                / 'i-bnn'             ; would not otherwise be
  //                / 'i-default'         ; considered 'well-formed'
  //                / 'i-enochian'        ; These tags are all valid,
  //                / 'i-hak'             ; but most are deprecated
  //                / 'i-klingon'         ; in favor of more modern
  //                / 'i-lux'             ; subtags or subtag
  //                / 'i-mingo'           ; combination
  //                / 'i-navajo'
  //                / 'i-pwn'
  //                / 'i-tao'
  //                / 'i-tay'
  //                / 'i-tsu'
  //                / 'sgn-BE-FR'
  //                / 'sgn-BE-NL'
  //                / 'sgn-CH-DE'
  const irregular = '(?:en-GB-oed|i-ami|i-bnn|i-default|i-enochian|i-hak|i-klingon|i-lux|i-mingo|i-navajo|i-pwn|i-tao|i-tay|i-tsu|sgn-BE-FR|sgn-BE-NL|sgn-CH-DE)';
  // grandfathered = irregular           ; non-redundant tags registered
  //               / regular             ; during the RFC 3066 era
  const grandfathered = '(?:' + irregular + '|' + regular + ')';
  // privateuse    = 'x' 1*('-' (1*8alphanum))
  const privateuse = '(?:x(?:-[a-z0-9]{1,8})+)';
  // singleton     = DIGIT               ; 0 - 9
  //               / %x41-57             ; A - W
  //               / %x59-5A             ; Y - Z
  //               / %x61-77             ; a - w
  //               / %x79-7A             ; y - z
  const singleton = '(?:' + DIGIT + '|[A-WY-Za-wy-z])';
  // extension     = singleton 1*('-' (2*8alphanum))
  const extension = '(?:' + singleton + '(?:-' + alphanum + '{2,8})+)';
  // variant       = 5*8alphanum         ; registered variants
  //               / (DIGIT 3alphanum)
  const variant = '(?:' + alphanum + '{5,8}|(?:' + DIGIT + alphanum + '{3}))';
  // region        = 2ALPHA              ; ISO 3166-1 code
  //               / 3DIGIT              ; UN M.49 code
  const region = '(?:' + ALPHA + '{2}|' + DIGIT + '{3})';
  // script        = 4ALPHA              ; ISO 15924 code
  const script = '(?:' + ALPHA + '{4})';
  // extlang       = 3ALPHA              ; selected ISO 639 codes
  //                 *2('-' 3ALPHA)      ; permanently reserved
  const extlang = '(?:' + ALPHA + '{3}(?:-' + ALPHA + '{3}){0,2})';
  // language      = 2*3ALPHA            ; shortest ISO 639 code
  //                 ['-' extlang]       ; sometimes followed by
  //                                     ; extended language subtags
  //               / 4ALPHA              ; or reserved for future use
  //               / 5*8ALPHA            ; or registered language subtag
  const language = '(?:' + ALPHA + '{2,3}(?:-' + extlang + ')?|' + ALPHA + '{4}|' + ALPHA + '{5,8})';
  // langtag       = language
  //                 ['-' script]
  //                 ['-' region]
  //                 *('-' variant)
  //                 *('-' extension)
  //                 ['-' privateuse]
  const langtag = language + '(?:-' + script + ')?(?:-' + region + ')?(?:-' +
    variant + ')*(?:-' + extension + ')*(?:-' + privateuse + ')?';
  // Language-Tag  = langtag             ; normal language tags
  //               / privateuse          ; private use tag
  //               / grandfathered       ; grandfathered tags
  const languageTag = '^(?:' + langtag + '|' + privateuse + '|' + grandfathered + ')$';

  // Language tags are case insensitive (RFC 5646 section 2.1.1).
  return new RegExp(languageTag, 'i');
}());

const duplicateVariantRE = (function () {
  // RFC 5234 section B.1
  // ALPHA          =  %x41-5A / %x61-7A   ; A-Z / a-z
  const ALPHA = '[a-zA-Z]';
  // DIGIT          =  %x30-39
  //                        ; 0-9
  const DIGIT = '[0-9]';

  // RFC 5646 section 2.1
  // alphanum      = (ALPHA / DIGIT)     ; letters and numbers
  const alphanum = '(?:' + ALPHA + '|' + DIGIT + ')';
  // variant       = 5*8alphanum         ; registered variants
  //               / (DIGIT 3alphanum)
  const variant = '(?:' + alphanum + '{5,8}|(?:' + DIGIT + alphanum + '{3}))';

  // Match a langtag that contains a duplicate variant.
  const duplicateVariant =
  // Match everything in a langtag prior to any variants, and maybe some
  // of the variants as well (which makes this pattern inefficient but
  // not wrong, for our purposes);
  '(?:' + alphanum + '{2,8}-)+' +
  // a variant, parenthesised so that we can refer back to it later;
  '(' + variant + ')-' +
  // zero or more subtags at least two characters long (thus stopping
  // before extension and privateuse components);
  '(?:' + alphanum + '{2,8}-)*' +
  // and the same variant again
  '\\1' +
  // ...but not followed by any characters that would turn it into a
  // different subtag.
  '(?!' + alphanum + ')';

  // Language tags are case insensitive (RFC 5646 section 2.1.1), but for
  // this regular expression that's covered by having its character classes
  // list both upper- and lower-case characters.
  return new RegExp(duplicateVariant);
}());

const duplicateSingletonRE = (function () {
  // RFC 5234 section B.1
  // ALPHA          =  %x41-5A / %x61-7A   ; A-Z / a-z
  const ALPHA = '[a-zA-Z]';
  // DIGIT          =  %x30-39
  //                        ; 0-9
  const DIGIT = '[0-9]';

  // RFC 5646 section 2.1
  // alphanum      = (ALPHA / DIGIT)     ; letters and numbers
  const alphanum = '(?:' + ALPHA + '|' + DIGIT + ')';
  // singleton     = DIGIT               ; 0 - 9
  //               / %x41-57             ; A - W
  //               / %x59-5A             ; Y - Z
  //               / %x61-77             ; a - w
  //               / %x79-7A             ; y - z
  const singleton = '(?:' + DIGIT + '|[A-WY-Za-wy-z])';

  // Match a langtag that contains a duplicate singleton.
  const duplicateSingleton =
  // Match a singleton subtag, parenthesised so that we can refer back to
  // it later;
    '-(' + singleton + ')-' +
    // then zero or more subtags;
    '(?:' + alphanum + '+-)*' +
    // and the same singleton again
    '\\1' +
    // ...but not followed by any characters that would turn it into a
    // different subtag.
    '(?!' + alphanum + ')';

  // Language tags are case insensitive (RFC 5646 section 2.1.1), but for
  // this regular expression that's covered by having its character classes
  // list both upper- and lower-case characters.
  return new RegExp(duplicateSingleton);
}());

/**
 * Removes Unicode locale extension sequences from the given language tag.
 */
function removeUnicodeExtensions(locale) {
  if (locale.startsWith('x-')) {
    return locale;
  }

  let pos = locale.indexOf('-x-');
  if (pos < 0) {
    pos = locale.length;
  }

  const left = locale.substring(0, pos);
  const right = locale.substring(pos);

  const combined = left + right;
  return combined;
}

/**
 * Verifies that the given string is a well-formed BCP 47 language tag
 * with no duplicate variant or singleton subtags.
 *
 * Spec: ECMAScript Internationalization API Specification, 6.2.2.
 */
function isStructurallyValidLanguageTag(locale) {
  if (!languageTagRE.test(locale)) {
    return false;
  }

  // Before checking for duplicate variant or singleton subtags with
  // regular expressions, we have to get private use subtag sequences
  // out of the picture.
  if (locale.startsWith('x-')) {
    return true;
  }
  const pos = locale.indexOf('-x-');
  if (pos !== -1) {
    locale = locale.substring(0, pos);
  }

  // Check for duplicate variant or singleton subtags.
  return !duplicateVariantRE.test(locale) &&
    !duplicateSingletonRE.test(locale);
}

/**
 * Canonicalizes the given structurally valid BCP 47 language tag, including
 * regularized case of subtags. For example, the language tag
 * Zh-NAN-haNS-bu-variant2-Variant1-u-ca-chinese-t-Zh-laTN-x-PRIVATE, where
 *
 *     Zh             ; 2*3ALPHA
 *     -NAN           ; ['-' extlang]
 *     -haNS          ; ['-' script]
 *     -bu            ; ['-' region]
 *     -variant2      ; *('-' variant)
 *     -Variant1
 *     -u-ca-chinese  ; *('-' extension)
 *     -t-Zh-laTN
 *     -x-PRIVATE     ; ['-' privateuse]
 *
 * becomes nan-Hans-mm-variant2-variant1-t-zh-latn-u-ca-chinese-x-private
 *
 * Spec: ECMAScript Internationalization API Specification, 6.2.3.
 * Spec: RFC 5646, section 4.5.
 */
function canonicalizeLanguageTag(locale) {
  // The input
  // 'Zh-NAN-haNS-bu-variant2-Variant1-u-ca-chinese-t-Zh-laTN-x-PRIVATE'
  // will be used throughout this method to illustrate how it works.

  // Language tags are compared and processed case-insensitively, so
  // technically it's not necessary to adjust case. But for easier processing,
  // and because the canonical form for most subtags is lower case, we start
  // with lower case for all.
  // 'Zh-NAN-haNS-bu-variant2-Variant1-u-ca-chinese-t-Zh-laTN-x-PRIVATE' ->
  // 'zh-nan-hans-bu-variant2-variant1-u-ca-chinese-t-zh-latn-x-private'
  locale = locale.toLowerCase();

  // Handle mappings for complete tags.
  if (langTagMappings && langTagMappings.hasOwnProperty(locale)) {
    return langTagMappings[locale];
  }

  const subtags = locale.split('-');
  let i = 0;

  // Handle the standard part: All subtags before the first singleton or 'x'.
  // 'zh-nan-hans-bu-variant2-variant1'
  while (i < subtags.length) {
    let subtag = subtags[i];

    // If we reach the start of an extension sequence or private use part,
    // we're done with this loop. We have to check for i > 0 because for
    // irregular language tags, such as i-klingon, the single-character
    // subtag 'i' is not the start of an extension sequence.
    // In the example, we break at 'u'.
    if (subtag.length === 1 && (i > 0 || subtag === 'x')) {
      break;
    }

    if (subtag.length === 4) {
      // 4-character subtags are script codes; their first character
      // needs to be capitalized. 'hans' -> 'Hans'
      subtag = subtag[0].toUpperCase() +
        subtag.substring(1);
    } else if (i !== 0 && subtag.length === 2) {
      // 2-character subtags that are not in initial position are region
      // codes; they need to be upper case. 'bu' -> 'BU'
      subtag = subtag.toUpperCase();
    }
    if (langSubtagMappings.hasOwnProperty(subtag)) {
      // Replace deprecated subtags with their preferred values.
      // 'BU' -> 'MM'
      // This has to come after we capitalize region codes because
      // otherwise some language and region codes could be confused.
      // For example, 'in' is an obsolete language code for Indonesian,
      // but 'IN' is the country code for India.
      // Note that the script generating langSubtagMappings makes sure
      // that no regular subtag mapping will replace an extlang code.
      subtag = langSubtagMappings[subtag];
    } else if (extlangMappings.hasOwnProperty(subtag)) {
      // Replace deprecated extlang subtags with their preferred values,
      // and remove the preceding subtag if it's a redundant prefix.
      // 'zh-nan' -> 'nan'
      // Note that the script generating extlangMappings makes sure that
      // no extlang mapping will replace a normal language code.
      subtag = extlangMappings[subtag].preferred;
      if (i === 1 && extlangMappings[subtag].prefix === subtags[0]) {
        subtags.shift();
        i--;
      }
    }
    subtags[i] = subtag;
    i++;
  }
  const normal = subtags.slice(0, i).join('-');

  // Extension sequences are sorted by their singleton characters.
  // 'u-ca-chinese-t-zh-latn' -> 't-zh-latn-u-ca-chinese'
  const extensions = [];
  while (i < subtags.length && subtags[i] !== 'x') {
    const extensionStart = i;
    i++;
    while (i < subtags.length && subtags[i].length > 1) {
      i++;
    }
    const extension = sybtags.slice(extensionStart, i).join('-');
    extensions.push(extension);
  }
  extensions.sort();

  // Private use sequences are left as is. 'x-private'
  let privateUse = '';
  if (i < subtags.length) {
    privateUse = subtags.slice(i).join('-');
  }

  // Put everything back together.
  let canonical = normal;
  if (extensions.length > 0) {
    canonical += '-' + extensions.join('-');
  }
  if (privateUse.length > 0) {
    // Be careful of a Language-Tag that is entirely privateuse.
    if (canonical.length > 0) {
      canonical += '-' + privateUse;
    } else {
      canonical = privateUse;
    }
  }

  return canonical;
}

function canonicalizeLocaleList(locales) {
  if (locales === undefined) {
    return new Set();
  }

  const seen = new Set();

  if (typeof locales === 'string') {
    locales = [locales];
  }

  locales.forEach(tag => {
    if (!isStructurallyValidLanguageTag(tag)) {
      throw new RangeError('invalid language tag ' + tag);
    }
    tag = canonicalizeLanguageTag(tag);
    seen.add(tag);
  });
  return seen;
}

/**
 * Compares a BCP 47 language priority list against availableLocales and
 * determines the best available language to meet the request. Options specified
 * through Unicode extension subsequences are negotiated separately, taking the
 * caller's relevant extensions and locale data as well as client-provided
 * options into consideration.
 *
 * Spec: ECMAScript Internationalization API Specification, 9.2.5.
 */
function resolveLocale(availableLocales, requestedLocales, options,
    relevantExtensionKeys, localeData) {

  // Steps 1-3.
  const matcher = options.localeMatcher;
  const r = (matcher === 'lookup') ?
    LookupMatcher(availableLocales, requestedLocales) :
    BestFitMatcher(availableLocales, requestedLocales);

  // Step 4.
  const foundLocale = r.locale;

  // Step 5.a.
  const extension = r.extension;

  // Step 5.
  if (extension !== undefined) {
    // Step 5.b.
    extensionIndex = r.extensionIndex;

    // Steps 5.d-e.
    extensionSubtags = extension.split('-');
    extensionSubtagsLength = extensionSubtags.length;
  }

  const result = new {};
  result.dataLocale = foundLocale;

  // Step 8.
  const supportedExtension = '-u';
}

const Locale = {
  canonicalizeLocaleList,
  resolveLocale: function() {},
  prioritizeAvailableLocales: function() {},
}


export default Locale;

/*global ClobberIntlLocale:false */

if (typeof Intl === 'undefined') {
    if (typeof global !== 'undefined') {
        global.Intl = { Locale };
    } else if (typeof window !== 'undefined') {
        window.Intl = { Locale };
    } else {
        this.Intl = { Locale };
    }
} else if (!Intl.Locale || (typeof ClobberIntlLocale !== 'undefined' &&
      ClobberIntlLocale)) {
    Intl.Locale = Locale;
} else if (typeof console !== 'undefined') {
    console.warn('Intl.Locale already exists, and has NOT been replaced by this polyfill');
    console.log('To force, set a global ClobberIntlLocale = true');
}
