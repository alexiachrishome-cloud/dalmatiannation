/* Dalmatian Nation — tiny, dependency-free front-end helpers. */
(function () {
  'use strict';

  var pageStart = Date.now();   // used by the survey's "real people take a while" check

  // Thank-you page after the survey: show the LEGACY number if our Google script handed one back.
  var slot = document.getElementById('legacy-result');
  if (slot) {
    var saved = null;
    try { saved = JSON.parse(sessionStorage.getItem('dn_legacy') || 'null'); sessionStorage.removeItem('dn_legacy'); } catch (err) { saved = null; }
    if (saved && saved.legacy) {
      slot.querySelector('.legacy-num').textContent = String(saved.legacy);
      slot.querySelector('.legacy-gift').hidden = !saved.gift;
      slot.querySelector('.legacy-repeat').hidden = true;
      slot.hidden = false;
    } else if (saved && saved.repeat) {
      slot.querySelector('.legacy-label').hidden = true;
      slot.querySelector('.legacy-num').hidden = true;
      slot.querySelector('.legacy-gift').hidden = true;
      slot.querySelector('.legacy-repeat').hidden = false;
      slot.hidden = false;
    }
  }

  // Put the protected email address back together (the page only holds reversed halves,
  // so simple scraping bots never see a real address). Plain text, not a link.
  var rev = function (s) { return (s || '').split('').reverse().join(''); };
  document.querySelectorAll('.email-protect[data-u][data-d]').forEach(function (el) {
    el.textContent = rev(el.getAttribute('data-u')) + '@' + rev(el.getAttribute('data-d'));
  });

  // Mobile navigation toggle
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
  }

  // Character counters on textareas that declare data-max
  document.querySelectorAll('textarea[data-max]').forEach(function (ta) {
    var max = parseInt(ta.getAttribute('data-max'), 10);
    var out = document.createElement('p');
    out.className = 'counter';
    ta.insertAdjacentElement('afterend', out);
    var update = function () {
      var n = ta.value.length;
      out.textContent = n + ' / ' + max;
      out.style.color = n > max ? '#b3261e' : '';
    };
    ta.addEventListener('input', update);
    update();
  });

  // Survey: before sending, check every required question is answered (including any
  // "tell us more" box under a ticked option). If not, pop up which ones and stay put —
  // nothing typed is lost. (The PHP preview checks again; on GitHub Pages this is the check.)
  document.querySelectorAll('form').forEach(function (form) {
    var questions = form.querySelectorAll('.question[data-required]');
    if (!questions.length) { return; }
    form.addEventListener('submit', function (e) {
      var missing = [];
      questions.forEach(function (q) {
        var ok = false;
        q.querySelectorAll('input[type="text"], textarea').forEach(function (t) {
          if (!t.closest('.follow-up') && t.value.trim() !== '') { ok = true; }
        });
        q.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked').forEach(function (c) {
          ok = true;
          var li = c.closest('li');
          var more = li ? li.querySelector('.follow-up input') : null;
          if (more && more.value.trim() === '') { ok = false; }
        });
        q.classList.toggle('has-error', !ok);
        if (!ok) { missing.push(q.getAttribute('data-qnum')); }
      });
      if (missing.length) {
        e.preventDefault();
        window.alert('Please complete question' + (missing.length > 1 ? 's ' : ' ') + missing.join(', ') + ' to submit the survey.');
        var first = form.querySelector('.question.has-error');
        if (first) { first.scrollIntoView({ block: 'center' }); }
      }
    });
  });

  // GitHub Pages site: survey + contact forms go to Web3Forms, which emails them to us.
  // We send the form ourselves so every email has the SAME fields in the SAME order, plus a
  // DATA_JSON field (one line of JSON) that can be parsed back at home. Registered after the
  // "please complete question…" check and before the double-submit guard.
  document.querySelectorAll('form[data-web3forms]').forEach(function (form) {
    var kind = form.getAttribute('data-web3forms');
    var val = function (name) {   // a visible field
      var el = form.querySelector('[name="' + name + '"]:not([type="hidden"])');
      return el ? String(el.value || '').trim() : '';
    };
    var hval = function (name) {  // one of the hidden Web3Forms settings
      var el = form.querySelector('input[type="hidden"][name="' + name + '"]');
      return el ? String(el.value || '').trim() : '';
    };
    var ticked = function (name) {
      var el = form.querySelector('[name="' + name + '"]');
      return !!(el && el.checked);
    };
    var answerOf = function (q) {
      var parts = [];
      q.querySelectorAll('input[type="text"], textarea').forEach(function (t) {
        if (!t.closest('.follow-up') && t.value.trim() !== '') { parts.push(t.value.trim()); }
      });
      q.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked').forEach(function (c) {
        var text = c.value;
        var li = c.closest('li');
        var more = li ? li.querySelector('.follow-up input') : null;
        var prompt = li ? li.querySelector('.follow-up label') : null;
        if (more && more.value.trim() !== '') {
          text += ' — ' + (prompt ? prompt.textContent.trim() : '') + ' ' + more.value.trim();
        }
        parts.push(text);
      });
      return parts.join('; ');
    };
    var fail = function (btn, msg) {
      if (btn) {
        btn.classList.remove('is-busy');
        btn.removeAttribute('aria-disabled');
        if (btn.getAttribute('data-orig')) { btn.innerHTML = btn.getAttribute('data-orig'); }
      }
      window.alert(msg);
    };

    form.addEventListener('submit', function (e) {
      if (e.defaultPrevented) { return; }   // a question is still missing — already told them
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      if (btn && btn.classList.contains('is-busy')) { return; }

      var name = val('name'), email = val('email'), phone = val('phone');
      var problems = [];
      if (name.length < 2) { problems.push('your name'); }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { problems.push('a valid email address'); }
      if (kind === 'contact' && val('subject').length < 3) { problems.push('a subject'); }
      if (kind === 'contact' && val('message').length < 10) { problems.push('a message (at least 10 characters)'); }
      if ((ticked('consent_phone') || ticked('consent_sms')) && phone === '') { problems.push('a mobile number (or untick the phone/text boxes)'); }
      if (problems.length) {
        window.alert('Please add ' + problems.join(', ') + ' to send this.');
        return;
      }
      if (ticked('botcheck')) { window.location.href = form.getAttribute('data-thanks'); return; }   // bot
      if (hval('access_key') === '') {
        window.alert('Sorry — this form isn\'t switched on yet. Please try again soon.');
        return;
      }

      var consentVersion = form.getAttribute('data-consent-version') || '';
      var yes = function (b) { return b ? 'Yes' : 'No'; };
      var payload = {
        access_key: hval('access_key'),
        subject: hval('subject') + ' — ' + name,
        from_name: hval('from_name'),
        botcheck: false,
        'Form': kind,
        'Name': name,
        'email': email,
        'Mobile': phone || '-'
      };
      var data = {
        form: kind,
        submitted_at: new Date().toISOString(),
        name: name,
        email: email,
        mobile: phone,
        consent: { email: ticked('consent_email'), phone: ticked('consent_phone'), sms: ticked('consent_sms') },
        consent_version: consentVersion
      };
      if (kind === 'survey') {
        data.answers = [];
        form.querySelectorAll('.question[data-qnum]').forEach(function (q) {
          var n = q.getAttribute('data-qnum');
          var label = q.getAttribute('data-qlabel') || '';
          var answer = answerOf(q);
          payload['Q' + n + '. ' + label] = answer || '-';
          // Same answer, pre-split for parsing: which options were ticked, and any "tell us more" text per option.
          var picked = [], details = {};
          q.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked').forEach(function (c) {
            picked.push(c.value);
            var li = c.closest('li');
            var more = li ? li.querySelector('.follow-up input') : null;
            if (more && more.value.trim() !== '') { details[c.value] = more.value.trim(); }
          });
          data.answers.push({ n: parseInt(n, 10), question: label, answer: answer, picked: picked, details: details });
        });
      } else {
        payload['Subject'] = val('subject');
        payload['Message'] = val('message');
        data.subject = val('subject');
        data.message = val('message');
      }
      payload['Consent - email'] = yes(data.consent.email);
      payload['Consent - phone'] = yes(data.consent.phone);
      if (kind === 'survey') { payload['Consent - SMS'] = yes(data.consent.sms); }
      payload['Consent wording version'] = consentVersion;
      payload['DATA_JSON'] = JSON.stringify(data);

      if (btn) {
        btn.setAttribute('data-orig', btn.innerHTML);
        btn.classList.add('is-busy');
        btn.setAttribute('aria-disabled', 'true');
        if (btn.getAttribute('data-busy')) { btn.textContent = btn.getAttribute('data-busy'); }
      }
      fetch(form.getAttribute('action'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (r) { return r.json(); }).then(function (res) {
        if (res && res.success) {
          var go = function () { window.location.href = form.getAttribute('data-thanks'); };
          var endpoint = kind === 'survey' ? form.getAttribute('data-legacy-endpoint') : '';
          if (!endpoint) { go(); return; }
          // Instant LEGACY number: ask our Google script (plain-text POST, so no extra browser checks).
          // Never hold the person up for more than 8 seconds; if it doesn't answer, the number still
          // arrives by email (the script also picks up the Web3Forms email as a backstop).
          var finished = false;
          var finish = function (result) {
            if (finished) { return; }
            finished = true;
            try { if (result) { sessionStorage.setItem('dn_legacy', JSON.stringify(result)); } } catch (err) { /* private mode */ }
            go();
          };
          setTimeout(function () { finish(null); }, 8000);
          var legacyReq = {
            token: form.getAttribute('data-legacy-token') || '',
            website: ticked('botcheck') ? 'x' : '',
            elapsed_ms: Date.now() - pageStart
          };
          for (var k in data) { if (Object.prototype.hasOwnProperty.call(data, k)) { legacyReq[k] = data[k]; } }
          fetch(endpoint, { method: 'POST', body: JSON.stringify(legacyReq), redirect: 'follow' })
            .then(function (r) { return r.json(); })
            .then(function (lr) {
              if (lr && lr.ok && lr.legacy) { finish({ legacy: lr.legacy, gift: !!lr.gift }); }
              else if (lr && lr.ok && lr.repeat) { finish({ repeat: true }); }
              else { finish(null); }
            })
            .catch(function () { finish(null); });
        } else {
          fail(btn, 'Sorry — that didn\'t send (' + ((res && res.message) || 'unknown error') + '). Your answers are still here, please try again in a minute.');
        }
      }).catch(function () {
        fail(btn, 'Sorry — that didn\'t send. Please check your internet connection and try again. Your answers are still here.');
      });
    });
  });

  // Prevent double submits and show a busy state
  document.querySelectorAll('form[data-guard]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      if (e.defaultPrevented) { return; }
      var btn = form.querySelector('button[type="submit"]');
      if (!btn) { return; }
      if (btn.classList.contains('is-busy')) { return false; }
      btn.classList.add('is-busy');
      btn.setAttribute('aria-disabled', 'true');
      var label = btn.getAttribute('data-busy');
      if (label) { btn.textContent = label; }
    });
  });

  // Confirm destructive admin actions
  document.querySelectorAll('form[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      if (!window.confirm(form.getAttribute('data-confirm'))) { e.preventDefault(); }
    });
  });

  // Survey: show/hide the "options" box depending on question type (admin)
  var typeSel = document.getElementById('q-type');
  var optsBox = document.getElementById('q-options-wrap');
  if (typeSel && optsBox) {
    var sync = function () {
      var needs = typeSel.value === 'single' || typeSel.value === 'multi';
      optsBox.hidden = !needs;
    };
    typeSel.addEventListener('change', sync);
    sync();
  }

  // Scroll the first error into view after a failed submit
  var firstErr = document.querySelector('.field.has-error, .alert-err');
  if (firstErr && window.location.hash === '') {
    firstErr.scrollIntoView({ block: 'center' });
  }

  // Google Analytics 4 — only ever loaded AFTER the visitor clicks "Yes" on the cookie message.
  // The measurement ID comes from <meta name="dn-ga"> (set via site.ga_id in config). "No" = nothing
  // is loaded and nothing is set, except remembering the choice itself (local storage, not a cookie).
  var gaMeta = document.querySelector('meta[name="dn-ga"]');
  var banner = document.getElementById('cookie-banner');
  if (gaMeta && gaMeta.getAttribute('content')) {
    var gaId = gaMeta.getAttribute('content');
    var KEY = 'dn_consent';
    var read = function () { try { return window.localStorage.getItem(KEY); } catch (e) { return null; } };
    var write = function (v) { try { window.localStorage.setItem(KEY, v); } catch (e) { /* private mode: just don't remember */ } };
    var loaded = false;
    var loadGA = function () {
      if (loaded) { return; }
      loaded = true;
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
      window.gtag('js', new Date());
      window.gtag('config', gaId, { anonymize_ip: true, allow_google_signals: false, allow_ad_personalization_signals: false });
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(gaId);
      document.head.appendChild(s);
    };
    var show = function () { if (banner) { banner.hidden = false; } };
    var hide = function () { if (banner) { banner.hidden = true; } };
    var choice = read();
    if (choice === 'yes') { loadGA(); } else if (choice !== 'no') { show(); }
    document.querySelectorAll('[data-consent]').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.getAttribute('data-consent') === 'yes' ? 'yes' : 'no';
        write(v);
        hide();
        if (v === 'yes') { loadGA(); }
      });
    });
    document.querySelectorAll('[data-cookie-settings]').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); show(); });
    });
  }
})();
