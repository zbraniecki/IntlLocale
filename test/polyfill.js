describe('Intl.Locale polyfill', function() {
  it('should exist', function() {
    expect(Intl.Locale).to.be.an(Object);
  });

  describe('canonicalizeLocaleList', function() {
    it('should exist', function() {
      expect(Intl.Locale.canonicalizeLocaleList).to.be.a(Function);
    });
    it('should work with no arguments', function() {
      const res = Intl.Locale.canonicalizeLocaleList();
      expect(res).to.be.a(Set);
      expect(res.size).to.be(0);
    });
    it('should work with empty Set as an argument', function() {
      const res = Intl.Locale.canonicalizeLocaleList(new Set());
      expect(res).to.be.a(Set);
      expect(res.size).to.be(0);
    });
    it('should work with empty Array as an argument', function() {
      const res = Intl.Locale.canonicalizeLocaleList([]);
      expect(res).to.be.a(Set);
      expect(res.size).to.be(0);
    });
    it('should work with a String as an argument', function() {
      const res = Intl.Locale.canonicalizeLocaleList('fr-FR');
      expect(res).to.be.a(Set);
      expect(res.size).to.be(1);
      const entries = res.entries();
      expect(entries.next().value[0], 'fr-FR');
    });
    it('should work with an Array as an argument', function() {
      const res = Intl.Locale.canonicalizeLocaleList(['de', 'fr-FR']);
      expect(res).to.be.a(Set);
      expect(res.size).to.be(2);
      const entries = res.entries();
      expect(entries.next().value[0], 'de');
      expect(entries.next().value[1], 'fr-FR');
    });
    it('should work with a Set as an argument', function() {
      const res = Intl.Locale.canonicalizeLocaleList(new Set(['de', 'fr-FR']));
      expect(res).to.be.a(Set);
      expect(res.size).to.be(2);
      const entries = res.entries();
      expect(entries.next().value[0], 'de');
      expect(entries.next().value[1], 'fr-FR');
    });
    it('should work with a Set as an argument', function() {
      const res = Intl.Locale.canonicalizeLocaleList(new Set(['de', 'fr-FR']));
      expect(res).to.be.a(Set);
      expect(res.size).to.be(2);
      const entries = res.entries();
      expect(entries.next().value[0], 'de');
      expect(entries.next().value[1], 'fr-FR');
    });
    it('should throw on invalid language tag', function() {
      const list = ['de', 'wrong-tag', 'fr-FR'];
      const boundFn = Intl.Locale.canonicalizeLocaleList.bind(null, list);
      expect(boundFn).to.throwException(/invalid language tag/);
    });
  });
});
