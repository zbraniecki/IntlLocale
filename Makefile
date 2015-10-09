VT = \033[$(1)m
VT0 := $(call VT,0)
VT_DIM := $(call VT,2)
VT_HL := $(call VT,33;1)
CHK := $(call VT,32;1)✓${VT0}
ERR := $(call VT,31;1)✖${VT0}

GH_API_FETCH_VALUE = curl -s https://api.github.com/$(1) | grep -m1 '"$(2)"' | cut -d: -f2 | sed 's/^ *"\?//;s/"\?, *$$//'

GH_REPO = zbraniecki/IntlLocale
NPM_TAG = latest

BIN = ./node_modules/.bin

RESULTS = polyfill.js polyfill.min.js

.PHONY: all clean lint test test-browser release-check-init release-check-branch release-check-head release

all: polyfill.js .make_lint .make_test polyfill.min.js

clean: ; rm -rf $(RESULTS) .make_*


polyfill.js: src/polyfill.js
	$(BIN)/browserify $< -t babelify -s LocalePolyfill -o $@

polyfill.min.js: polyfill.js
	$(BIN)/uglifyjs $< --compress --mangle -o $@


lint: .make_lint
.make_lint: src/polyfill.js
	$(BIN)/eslint $^
	@touch $@

test: .make_test
.make_test: polyfill.js test/*
	@echo "\n  $(VT_DIM)Testing polyfill...$(VT0)"
	@$(BIN)/mocha test/polyfill.js
	@touch $@

test-browser: polyfill.js test/*
	open "http://localhost:8080/test/" & $(BIN)/http-server .


release-check-init:
	@if [ -z "$(VERSION)" ]; then echo "$(ERR) Release version not set! Use 'make release VERSION=... [NPM_TAG=...]'\n"; exit 1; fi
	@if ! git diff-index --quiet HEAD; then echo "$(ERR) Git working directory is not clean!\n"; exit 1; fi
	@echo "$(CHK) Git working directory is clean"
	@echo "  $(VT_DIM)Fetching remote data from github...$(VT0)"

release-check-branch:
	$(eval GH_BRANCH := $(shell $(call GH_API_FETCH_VALUE,repos/$(GH_REPO),default_branch)))
	$(eval GH_BRANCH_PRETTY := $(VT_HL)$(GH_BRANCH)$(VT0))
	@if [ `git rev-parse --abbrev-ref HEAD` != "$(GH_BRANCH)" ]; then echo "$(ERR) Not on default branch $(GH_BRANCH_PRETTY)!\n"; exit 1; fi
	@echo "$(CHK) Local branch matches remote default $(GH_BRANCH_PRETTY)"

release-check-head: release-check-branch
	$(eval GH_HEAD := $(shell $(call GH_API_FETCH_VALUE,repos/$(GH_REPO)/git/refs/heads/$(GH_BRANCH),sha)))
	$(eval GH_HEAD_PRETTY := $(VT_HL)$(shell echo "$(GH_HEAD)" | cut -c1-7)$(VT0))
	@if [ `git rev-parse HEAD` != "$(GH_HEAD)" ]; then echo "$(ERR) Local HEAD doesn't match remote HEAD $(GH_HEAD_PRETTY)\n"; exit 1; fi
	@echo "$(CHK) Local HEAD matches remote HEAD $(GH_HEAD_PRETTY)"

release: all release-check-init release-check-branch release-check-head
	@echo "$(CHK) All release checks passed\n"
	@printf "  Push new tag $(VT_HL)v$(VERSION)$(VT0) to github and publish as $(VT_HL)$(VERSION)$(VT0) @ $(VT_HL)$(NPM_TAG)$(VT0) on npm?"
	@read -p " [y/N] " -n 1 -r -s; \
		if [[ $${REPLY} =~ ^[Yy]$$ ]]; then echo "$${REPLY}\r$(CHK)\n"; \
		else echo "\r$(ERR)\n"; exit 1; fi
	git checkout $(GH_HEAD)
	git add -f $(RESULTS)
	git commit --message "Packaging results for release"
	npm version $(VERSION) -m "Version %s"
	git push --tags
	npm publish --tag $(NPM_TAG)
	git checkout $(GH_BRANCH)

