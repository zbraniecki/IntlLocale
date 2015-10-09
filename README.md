Intl.Locale
================

A polyfill for the upcoming [Intl.Locale](https://github.com/zbraniecki/intl-locale-spec)
specification.


## Installation

```
npm install intl-locale
```
_or_
```
git clone https://github.com/zbraniecki/IntlLocale.git
cd IntlLocale
npm install
make
```
_or_ download the latest release from
[here](https://github.com/zbraniecki/IntlLocale/releases/latest)


## Usage

The package's `polyfill.js` contains an UMD wrapper, so you can include or
require it pretty much anywhere. When included, it'll set `Intl.Locale`
according to the spec.

This version follows the Oct 2015 spec.
