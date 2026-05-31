var lc = Object.defineProperty;
var ic = (e, t, n) =>
  t in e
    ? lc(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n })
    : (e[t] = n);
var Oe = (e, t, n) => ic(e, typeof t != 'symbol' ? t + '' : t, n);
(function () {
  const t = document.createElement('link').relList;
  if (t && t.supports && t.supports('modulepreload')) return;
  for (const l of document.querySelectorAll('link[rel="modulepreload"]')) r(l);
  new MutationObserver((l) => {
    for (const i of l)
      if (i.type === 'childList')
        for (const o of i.addedNodes)
          o.tagName === 'LINK' && o.rel === 'modulepreload' && r(o);
  }).observe(document, { childList: !0, subtree: !0 });
  function n(l) {
    const i = {};
    return (
      l.integrity && (i.integrity = l.integrity),
      l.referrerPolicy && (i.referrerPolicy = l.referrerPolicy),
      l.crossOrigin === 'use-credentials'
        ? (i.credentials = 'include')
        : l.crossOrigin === 'anonymous'
          ? (i.credentials = 'omit')
          : (i.credentials = 'same-origin'),
      i
    );
  }
  function r(l) {
    if (l.ep) return;
    l.ep = !0;
    const i = n(l);
    fetch(l.href, i);
  }
})();
var Wu = { exports: {} },
  T = {};
/**
 * @license React
 * react.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */ var Gn = Symbol.for('react.element'),
  oc = Symbol.for('react.portal'),
  uc = Symbol.for('react.fragment'),
  sc = Symbol.for('react.strict_mode'),
  ac = Symbol.for('react.profiler'),
  cc = Symbol.for('react.provider'),
  fc = Symbol.for('react.context'),
  dc = Symbol.for('react.forward_ref'),
  pc = Symbol.for('react.suspense'),
  hc = Symbol.for('react.memo'),
  mc = Symbol.for('react.lazy'),
  Io = Symbol.iterator;
function vc(e) {
  return e === null || typeof e != 'object'
    ? null
    : ((e = (Io && e[Io]) || e['@@iterator']),
      typeof e == 'function' ? e : null);
}
var Hu = {
    isMounted: function () {
      return !1;
    },
    enqueueForceUpdate: function () {},
    enqueueReplaceState: function () {},
    enqueueSetState: function () {},
  },
  Qu = Object.assign,
  Ku = {};
function on(e, t, n) {
  ((this.props = e),
    (this.context = t),
    (this.refs = Ku),
    (this.updater = n || Hu));
}
on.prototype.isReactComponent = {};
on.prototype.setState = function (e, t) {
  if (typeof e != 'object' && typeof e != 'function' && e != null)
    throw Error(
      'setState(...): takes an object of state variables to update or a function which returns an object of state variables.',
    );
  this.updater.enqueueSetState(this, e, t, 'setState');
};
on.prototype.forceUpdate = function (e) {
  this.updater.enqueueForceUpdate(this, e, 'forceUpdate');
};
function Yu() {}
Yu.prototype = on.prototype;
function Ui(e, t, n) {
  ((this.props = e),
    (this.context = t),
    (this.refs = Ku),
    (this.updater = n || Hu));
}
var Ai = (Ui.prototype = new Yu());
Ai.constructor = Ui;
Qu(Ai, on.prototype);
Ai.isPureReactComponent = !0;
var Oo = Array.isArray,
  Xu = Object.prototype.hasOwnProperty,
  $i = { current: null },
  Gu = { key: !0, ref: !0, __self: !0, __source: !0 };
function Zu(e, t, n) {
  var r,
    l = {},
    i = null,
    o = null;
  if (t != null)
    for (r in (t.ref !== void 0 && (o = t.ref),
    t.key !== void 0 && (i = '' + t.key),
    t))
      Xu.call(t, r) && !Gu.hasOwnProperty(r) && (l[r] = t[r]);
  var u = arguments.length - 2;
  if (u === 1) l.children = n;
  else if (1 < u) {
    for (var s = Array(u), c = 0; c < u; c++) s[c] = arguments[c + 2];
    l.children = s;
  }
  if (e && e.defaultProps)
    for (r in ((u = e.defaultProps), u)) l[r] === void 0 && (l[r] = u[r]);
  return {
    $$typeof: Gn,
    type: e,
    key: i,
    ref: o,
    props: l,
    _owner: $i.current,
  };
}
function yc(e, t) {
  return {
    $$typeof: Gn,
    type: e.type,
    key: t,
    ref: e.ref,
    props: e.props,
    _owner: e._owner,
  };
}
function Bi(e) {
  return typeof e == 'object' && e !== null && e.$$typeof === Gn;
}
function gc(e) {
  var t = { '=': '=0', ':': '=2' };
  return (
    '$' +
    e.replace(/[=:]/g, function (n) {
      return t[n];
    })
  );
}
var Do = /\/+/g;
function kl(e, t) {
  return typeof e == 'object' && e !== null && e.key != null
    ? gc('' + e.key)
    : t.toString(36);
}
function wr(e, t, n, r, l) {
  var i = typeof e;
  (i === 'undefined' || i === 'boolean') && (e = null);
  var o = !1;
  if (e === null) o = !0;
  else
    switch (i) {
      case 'string':
      case 'number':
        o = !0;
        break;
      case 'object':
        switch (e.$$typeof) {
          case Gn:
          case oc:
            o = !0;
        }
    }
  if (o)
    return (
      (o = e),
      (l = l(o)),
      (e = r === '' ? '.' + kl(o, 0) : r),
      Oo(l)
        ? ((n = ''),
          e != null && (n = e.replace(Do, '$&/') + '/'),
          wr(l, t, n, '', function (c) {
            return c;
          }))
        : l != null &&
          (Bi(l) &&
            (l = yc(
              l,
              n +
                (!l.key || (o && o.key === l.key)
                  ? ''
                  : ('' + l.key).replace(Do, '$&/') + '/') +
                e,
            )),
          t.push(l)),
      1
    );
  if (((o = 0), (r = r === '' ? '.' : r + ':'), Oo(e)))
    for (var u = 0; u < e.length; u++) {
      i = e[u];
      var s = r + kl(i, u);
      o += wr(i, t, n, s, l);
    }
  else if (((s = vc(e)), typeof s == 'function'))
    for (e = s.call(e), u = 0; !(i = e.next()).done; )
      ((i = i.value), (s = r + kl(i, u++)), (o += wr(i, t, n, s, l)));
  else if (i === 'object')
    throw (
      (t = String(e)),
      Error(
        'Objects are not valid as a React child (found: ' +
          (t === '[object Object]'
            ? 'object with keys {' + Object.keys(e).join(', ') + '}'
            : t) +
          '). If you meant to render a collection of children, use an array instead.',
      )
    );
  return o;
}
function nr(e, t, n) {
  if (e == null) return e;
  var r = [],
    l = 0;
  return (
    wr(e, r, '', '', function (i) {
      return t.call(n, i, l++);
    }),
    r
  );
}
function wc(e) {
  if (e._status === -1) {
    var t = e._result;
    ((t = t()),
      t.then(
        function (n) {
          (e._status === 0 || e._status === -1) &&
            ((e._status = 1), (e._result = n));
        },
        function (n) {
          (e._status === 0 || e._status === -1) &&
            ((e._status = 2), (e._result = n));
        },
      ),
      e._status === -1 && ((e._status = 0), (e._result = t)));
  }
  if (e._status === 1) return e._result.default;
  throw e._result;
}
var se = { current: null },
  kr = { transition: null },
  kc = {
    ReactCurrentDispatcher: se,
    ReactCurrentBatchConfig: kr,
    ReactCurrentOwner: $i,
  };
function Ju() {
  throw Error('act(...) is not supported in production builds of React.');
}
T.Children = {
  map: nr,
  forEach: function (e, t, n) {
    nr(
      e,
      function () {
        t.apply(this, arguments);
      },
      n,
    );
  },
  count: function (e) {
    var t = 0;
    return (
      nr(e, function () {
        t++;
      }),
      t
    );
  },
  toArray: function (e) {
    return (
      nr(e, function (t) {
        return t;
      }) || []
    );
  },
  only: function (e) {
    if (!Bi(e))
      throw Error(
        'React.Children.only expected to receive a single React element child.',
      );
    return e;
  },
};
T.Component = on;
T.Fragment = uc;
T.Profiler = ac;
T.PureComponent = Ui;
T.StrictMode = sc;
T.Suspense = pc;
T.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = kc;
T.act = Ju;
T.cloneElement = function (e, t, n) {
  if (e == null)
    throw Error(
      'React.cloneElement(...): The argument must be a React element, but you passed ' +
        e +
        '.',
    );
  var r = Qu({}, e.props),
    l = e.key,
    i = e.ref,
    o = e._owner;
  if (t != null) {
    if (
      (t.ref !== void 0 && ((i = t.ref), (o = $i.current)),
      t.key !== void 0 && (l = '' + t.key),
      e.type && e.type.defaultProps)
    )
      var u = e.type.defaultProps;
    for (s in t)
      Xu.call(t, s) &&
        !Gu.hasOwnProperty(s) &&
        (r[s] = t[s] === void 0 && u !== void 0 ? u[s] : t[s]);
  }
  var s = arguments.length - 2;
  if (s === 1) r.children = n;
  else if (1 < s) {
    u = Array(s);
    for (var c = 0; c < s; c++) u[c] = arguments[c + 2];
    r.children = u;
  }
  return { $$typeof: Gn, type: e.type, key: l, ref: i, props: r, _owner: o };
};
T.createContext = function (e) {
  return (
    (e = {
      $$typeof: fc,
      _currentValue: e,
      _currentValue2: e,
      _threadCount: 0,
      Provider: null,
      Consumer: null,
      _defaultValue: null,
      _globalName: null,
    }),
    (e.Provider = { $$typeof: cc, _context: e }),
    (e.Consumer = e)
  );
};
T.createElement = Zu;
T.createFactory = function (e) {
  var t = Zu.bind(null, e);
  return ((t.type = e), t);
};
T.createRef = function () {
  return { current: null };
};
T.forwardRef = function (e) {
  return { $$typeof: dc, render: e };
};
T.isValidElement = Bi;
T.lazy = function (e) {
  return { $$typeof: mc, _payload: { _status: -1, _result: e }, _init: wc };
};
T.memo = function (e, t) {
  return { $$typeof: hc, type: e, compare: t === void 0 ? null : t };
};
T.startTransition = function (e) {
  var t = kr.transition;
  kr.transition = {};
  try {
    e();
  } finally {
    kr.transition = t;
  }
};
T.unstable_act = Ju;
T.useCallback = function (e, t) {
  return se.current.useCallback(e, t);
};
T.useContext = function (e) {
  return se.current.useContext(e);
};
T.useDebugValue = function () {};
T.useDeferredValue = function (e) {
  return se.current.useDeferredValue(e);
};
T.useEffect = function (e, t) {
  return se.current.useEffect(e, t);
};
T.useId = function () {
  return se.current.useId();
};
T.useImperativeHandle = function (e, t, n) {
  return se.current.useImperativeHandle(e, t, n);
};
T.useInsertionEffect = function (e, t) {
  return se.current.useInsertionEffect(e, t);
};
T.useLayoutEffect = function (e, t) {
  return se.current.useLayoutEffect(e, t);
};
T.useMemo = function (e, t) {
  return se.current.useMemo(e, t);
};
T.useReducer = function (e, t, n) {
  return se.current.useReducer(e, t, n);
};
T.useRef = function (e) {
  return se.current.useRef(e);
};
T.useState = function (e) {
  return se.current.useState(e);
};
T.useSyncExternalStore = function (e, t, n) {
  return se.current.useSyncExternalStore(e, t, n);
};
T.useTransition = function () {
  return se.current.useTransition();
};
T.version = '18.3.1';
Wu.exports = T;
var K = Wu.exports,
  qu = { exports: {} },
  we = {},
  bu = { exports: {} },
  es = {};
/**
 * @license React
 * scheduler.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */ (function (e) {
  function t(C, P) {
    var L = C.length;
    C.push(P);
    e: for (; 0 < L; ) {
      var H = (L - 1) >>> 1,
        Z = C[H];
      if (0 < l(Z, P)) ((C[H] = P), (C[L] = Z), (L = H));
      else break e;
    }
  }
  function n(C) {
    return C.length === 0 ? null : C[0];
  }
  function r(C) {
    if (C.length === 0) return null;
    var P = C[0],
      L = C.pop();
    if (L !== P) {
      C[0] = L;
      e: for (var H = 0, Z = C.length, er = Z >>> 1; H < er; ) {
        var yt = 2 * (H + 1) - 1,
          wl = C[yt],
          gt = yt + 1,
          tr = C[gt];
        if (0 > l(wl, L))
          gt < Z && 0 > l(tr, wl)
            ? ((C[H] = tr), (C[gt] = L), (H = gt))
            : ((C[H] = wl), (C[yt] = L), (H = yt));
        else if (gt < Z && 0 > l(tr, L)) ((C[H] = tr), (C[gt] = L), (H = gt));
        else break e;
      }
    }
    return P;
  }
  function l(C, P) {
    var L = C.sortIndex - P.sortIndex;
    return L !== 0 ? L : C.id - P.id;
  }
  if (typeof performance == 'object' && typeof performance.now == 'function') {
    var i = performance;
    e.unstable_now = function () {
      return i.now();
    };
  } else {
    var o = Date,
      u = o.now();
    e.unstable_now = function () {
      return o.now() - u;
    };
  }
  var s = [],
    c = [],
    v = 1,
    m = null,
    h = 3,
    S = !1,
    w = !1,
    x = !1,
    M = typeof setTimeout == 'function' ? setTimeout : null,
    f = typeof clearTimeout == 'function' ? clearTimeout : null,
    a = typeof setImmediate < 'u' ? setImmediate : null;
  typeof navigator < 'u' &&
    navigator.scheduling !== void 0 &&
    navigator.scheduling.isInputPending !== void 0 &&
    navigator.scheduling.isInputPending.bind(navigator.scheduling);
  function d(C) {
    for (var P = n(c); P !== null; ) {
      if (P.callback === null) r(c);
      else if (P.startTime <= C)
        (r(c), (P.sortIndex = P.expirationTime), t(s, P));
      else break;
      P = n(c);
    }
  }
  function y(C) {
    if (((x = !1), d(C), !w))
      if (n(s) !== null) ((w = !0), yl(k));
      else {
        var P = n(c);
        P !== null && gl(y, P.startTime - C);
      }
  }
  function k(C, P) {
    ((w = !1), x && ((x = !1), f(j), (j = -1)), (S = !0));
    var L = h;
    try {
      for (
        d(P), m = n(s);
        m !== null && (!(m.expirationTime > P) || (C && !je()));
      ) {
        var H = m.callback;
        if (typeof H == 'function') {
          ((m.callback = null), (h = m.priorityLevel));
          var Z = H(m.expirationTime <= P);
          ((P = e.unstable_now()),
            typeof Z == 'function' ? (m.callback = Z) : m === n(s) && r(s),
            d(P));
        } else r(s);
        m = n(s);
      }
      if (m !== null) var er = !0;
      else {
        var yt = n(c);
        (yt !== null && gl(y, yt.startTime - P), (er = !1));
      }
      return er;
    } finally {
      ((m = null), (h = L), (S = !1));
    }
  }
  var E = !1,
    _ = null,
    j = -1,
    U = 5,
    z = -1;
  function je() {
    return !(e.unstable_now() - z < U);
  }
  function an() {
    if (_ !== null) {
      var C = e.unstable_now();
      z = C;
      var P = !0;
      try {
        P = _(!0, C);
      } finally {
        P ? cn() : ((E = !1), (_ = null));
      }
    } else E = !1;
  }
  var cn;
  if (typeof a == 'function')
    cn = function () {
      a(an);
    };
  else if (typeof MessageChannel < 'u') {
    var Mo = new MessageChannel(),
      rc = Mo.port2;
    ((Mo.port1.onmessage = an),
      (cn = function () {
        rc.postMessage(null);
      }));
  } else
    cn = function () {
      M(an, 0);
    };
  function yl(C) {
    ((_ = C), E || ((E = !0), cn()));
  }
  function gl(C, P) {
    j = M(function () {
      C(e.unstable_now());
    }, P);
  }
  ((e.unstable_IdlePriority = 5),
    (e.unstable_ImmediatePriority = 1),
    (e.unstable_LowPriority = 4),
    (e.unstable_NormalPriority = 3),
    (e.unstable_Profiling = null),
    (e.unstable_UserBlockingPriority = 2),
    (e.unstable_cancelCallback = function (C) {
      C.callback = null;
    }),
    (e.unstable_continueExecution = function () {
      w || S || ((w = !0), yl(k));
    }),
    (e.unstable_forceFrameRate = function (C) {
      0 > C || 125 < C
        ? console.error(
            'forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported',
          )
        : (U = 0 < C ? Math.floor(1e3 / C) : 5);
    }),
    (e.unstable_getCurrentPriorityLevel = function () {
      return h;
    }),
    (e.unstable_getFirstCallbackNode = function () {
      return n(s);
    }),
    (e.unstable_next = function (C) {
      switch (h) {
        case 1:
        case 2:
        case 3:
          var P = 3;
          break;
        default:
          P = h;
      }
      var L = h;
      h = P;
      try {
        return C();
      } finally {
        h = L;
      }
    }),
    (e.unstable_pauseExecution = function () {}),
    (e.unstable_requestPaint = function () {}),
    (e.unstable_runWithPriority = function (C, P) {
      switch (C) {
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
          break;
        default:
          C = 3;
      }
      var L = h;
      h = C;
      try {
        return P();
      } finally {
        h = L;
      }
    }),
    (e.unstable_scheduleCallback = function (C, P, L) {
      var H = e.unstable_now();
      switch (
        (typeof L == 'object' && L !== null
          ? ((L = L.delay), (L = typeof L == 'number' && 0 < L ? H + L : H))
          : (L = H),
        C)
      ) {
        case 1:
          var Z = -1;
          break;
        case 2:
          Z = 250;
          break;
        case 5:
          Z = 1073741823;
          break;
        case 4:
          Z = 1e4;
          break;
        default:
          Z = 5e3;
      }
      return (
        (Z = L + Z),
        (C = {
          id: v++,
          callback: P,
          priorityLevel: C,
          startTime: L,
          expirationTime: Z,
          sortIndex: -1,
        }),
        L > H
          ? ((C.sortIndex = L),
            t(c, C),
            n(s) === null &&
              C === n(c) &&
              (x ? (f(j), (j = -1)) : (x = !0), gl(y, L - H)))
          : ((C.sortIndex = Z), t(s, C), w || S || ((w = !0), yl(k))),
        C
      );
    }),
    (e.unstable_shouldYield = je),
    (e.unstable_wrapCallback = function (C) {
      var P = h;
      return function () {
        var L = h;
        h = P;
        try {
          return C.apply(this, arguments);
        } finally {
          h = L;
        }
      };
    }));
})(es);
bu.exports = es;
var Sc = bu.exports;
/**
 * @license React
 * react-dom.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */ var xc = K,
  ge = Sc;
function g(e) {
  for (
    var t = 'https://reactjs.org/docs/error-decoder.html?invariant=' + e, n = 1;
    n < arguments.length;
    n++
  )
    t += '&args[]=' + encodeURIComponent(arguments[n]);
  return (
    'Minified React error #' +
    e +
    '; visit ' +
    t +
    ' for the full message or use the non-minified dev environment for full errors and additional helpful warnings.'
  );
}
var ts = new Set(),
  Rn = {};
function Tt(e, t) {
  (qt(e, t), qt(e + 'Capture', t));
}
function qt(e, t) {
  for (Rn[e] = t, e = 0; e < t.length; e++) ts.add(t[e]);
}
var Ke = !(
    typeof window > 'u' ||
    typeof window.document > 'u' ||
    typeof window.document.createElement > 'u'
  ),
  Kl = Object.prototype.hasOwnProperty,
  Ec =
    /^[:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD][:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]*$/,
  Fo = {},
  Uo = {};
function Nc(e) {
  return Kl.call(Uo, e)
    ? !0
    : Kl.call(Fo, e)
      ? !1
      : Ec.test(e)
        ? (Uo[e] = !0)
        : ((Fo[e] = !0), !1);
}
function Cc(e, t, n, r) {
  if (n !== null && n.type === 0) return !1;
  switch (typeof t) {
    case 'function':
    case 'symbol':
      return !0;
    case 'boolean':
      return r
        ? !1
        : n !== null
          ? !n.acceptsBooleans
          : ((e = e.toLowerCase().slice(0, 5)), e !== 'data-' && e !== 'aria-');
    default:
      return !1;
  }
}
function _c(e, t, n, r) {
  if (t === null || typeof t > 'u' || Cc(e, t, n, r)) return !0;
  if (r) return !1;
  if (n !== null)
    switch (n.type) {
      case 3:
        return !t;
      case 4:
        return t === !1;
      case 5:
        return isNaN(t);
      case 6:
        return isNaN(t) || 1 > t;
    }
  return !1;
}
function ae(e, t, n, r, l, i, o) {
  ((this.acceptsBooleans = t === 2 || t === 3 || t === 4),
    (this.attributeName = r),
    (this.attributeNamespace = l),
    (this.mustUseProperty = n),
    (this.propertyName = e),
    (this.type = t),
    (this.sanitizeURL = i),
    (this.removeEmptyString = o));
}
var te = {};
'children dangerouslySetInnerHTML defaultValue defaultChecked innerHTML suppressContentEditableWarning suppressHydrationWarning style'
  .split(' ')
  .forEach(function (e) {
    te[e] = new ae(e, 0, !1, e, null, !1, !1);
  });
[
  ['acceptCharset', 'accept-charset'],
  ['className', 'class'],
  ['htmlFor', 'for'],
  ['httpEquiv', 'http-equiv'],
].forEach(function (e) {
  var t = e[0];
  te[t] = new ae(t, 1, !1, e[1], null, !1, !1);
});
['contentEditable', 'draggable', 'spellCheck', 'value'].forEach(function (e) {
  te[e] = new ae(e, 2, !1, e.toLowerCase(), null, !1, !1);
});
[
  'autoReverse',
  'externalResourcesRequired',
  'focusable',
  'preserveAlpha',
].forEach(function (e) {
  te[e] = new ae(e, 2, !1, e, null, !1, !1);
});
'allowFullScreen async autoFocus autoPlay controls default defer disabled disablePictureInPicture disableRemotePlayback formNoValidate hidden loop noModule noValidate open playsInline readOnly required reversed scoped seamless itemScope'
  .split(' ')
  .forEach(function (e) {
    te[e] = new ae(e, 3, !1, e.toLowerCase(), null, !1, !1);
  });
['checked', 'multiple', 'muted', 'selected'].forEach(function (e) {
  te[e] = new ae(e, 3, !0, e, null, !1, !1);
});
['capture', 'download'].forEach(function (e) {
  te[e] = new ae(e, 4, !1, e, null, !1, !1);
});
['cols', 'rows', 'size', 'span'].forEach(function (e) {
  te[e] = new ae(e, 6, !1, e, null, !1, !1);
});
['rowSpan', 'start'].forEach(function (e) {
  te[e] = new ae(e, 5, !1, e.toLowerCase(), null, !1, !1);
});
var Vi = /[\-:]([a-z])/g;
function Wi(e) {
  return e[1].toUpperCase();
}
'accent-height alignment-baseline arabic-form baseline-shift cap-height clip-path clip-rule color-interpolation color-interpolation-filters color-profile color-rendering dominant-baseline enable-background fill-opacity fill-rule flood-color flood-opacity font-family font-size font-size-adjust font-stretch font-style font-variant font-weight glyph-name glyph-orientation-horizontal glyph-orientation-vertical horiz-adv-x horiz-origin-x image-rendering letter-spacing lighting-color marker-end marker-mid marker-start overline-position overline-thickness paint-order panose-1 pointer-events rendering-intent shape-rendering stop-color stop-opacity strikethrough-position strikethrough-thickness stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width text-anchor text-decoration text-rendering underline-position underline-thickness unicode-bidi unicode-range units-per-em v-alphabetic v-hanging v-ideographic v-mathematical vector-effect vert-adv-y vert-origin-x vert-origin-y word-spacing writing-mode xmlns:xlink x-height'
  .split(' ')
  .forEach(function (e) {
    var t = e.replace(Vi, Wi);
    te[t] = new ae(t, 1, !1, e, null, !1, !1);
  });
'xlink:actuate xlink:arcrole xlink:role xlink:show xlink:title xlink:type'
  .split(' ')
  .forEach(function (e) {
    var t = e.replace(Vi, Wi);
    te[t] = new ae(t, 1, !1, e, 'http://www.w3.org/1999/xlink', !1, !1);
  });
['xml:base', 'xml:lang', 'xml:space'].forEach(function (e) {
  var t = e.replace(Vi, Wi);
  te[t] = new ae(t, 1, !1, e, 'http://www.w3.org/XML/1998/namespace', !1, !1);
});
['tabIndex', 'crossOrigin'].forEach(function (e) {
  te[e] = new ae(e, 1, !1, e.toLowerCase(), null, !1, !1);
});
te.xlinkHref = new ae(
  'xlinkHref',
  1,
  !1,
  'xlink:href',
  'http://www.w3.org/1999/xlink',
  !0,
  !1,
);
['src', 'href', 'action', 'formAction'].forEach(function (e) {
  te[e] = new ae(e, 1, !1, e.toLowerCase(), null, !0, !0);
});
function Hi(e, t, n, r) {
  var l = te.hasOwnProperty(t) ? te[t] : null;
  (l !== null
    ? l.type !== 0
    : r ||
      !(2 < t.length) ||
      (t[0] !== 'o' && t[0] !== 'O') ||
      (t[1] !== 'n' && t[1] !== 'N')) &&
    (_c(t, n, l, r) && (n = null),
    r || l === null
      ? Nc(t) && (n === null ? e.removeAttribute(t) : e.setAttribute(t, '' + n))
      : l.mustUseProperty
        ? (e[l.propertyName] = n === null ? (l.type === 3 ? !1 : '') : n)
        : ((t = l.attributeName),
          (r = l.attributeNamespace),
          n === null
            ? e.removeAttribute(t)
            : ((l = l.type),
              (n = l === 3 || (l === 4 && n === !0) ? '' : '' + n),
              r ? e.setAttributeNS(r, t, n) : e.setAttribute(t, n))));
}
var Ze = xc.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED,
  rr = Symbol.for('react.element'),
  It = Symbol.for('react.portal'),
  Ot = Symbol.for('react.fragment'),
  Qi = Symbol.for('react.strict_mode'),
  Yl = Symbol.for('react.profiler'),
  ns = Symbol.for('react.provider'),
  rs = Symbol.for('react.context'),
  Ki = Symbol.for('react.forward_ref'),
  Xl = Symbol.for('react.suspense'),
  Gl = Symbol.for('react.suspense_list'),
  Yi = Symbol.for('react.memo'),
  qe = Symbol.for('react.lazy'),
  ls = Symbol.for('react.offscreen'),
  Ao = Symbol.iterator;
function fn(e) {
  return e === null || typeof e != 'object'
    ? null
    : ((e = (Ao && e[Ao]) || e['@@iterator']),
      typeof e == 'function' ? e : null);
}
var V = Object.assign,
  Sl;
function wn(e) {
  if (Sl === void 0)
    try {
      throw Error();
    } catch (n) {
      var t = n.stack.trim().match(/\n( *(at )?)/);
      Sl = (t && t[1]) || '';
    }
  return (
    `
` +
    Sl +
    e
  );
}
var xl = !1;
function El(e, t) {
  if (!e || xl) return '';
  xl = !0;
  var n = Error.prepareStackTrace;
  Error.prepareStackTrace = void 0;
  try {
    if (t)
      if (
        ((t = function () {
          throw Error();
        }),
        Object.defineProperty(t.prototype, 'props', {
          set: function () {
            throw Error();
          },
        }),
        typeof Reflect == 'object' && Reflect.construct)
      ) {
        try {
          Reflect.construct(t, []);
        } catch (c) {
          var r = c;
        }
        Reflect.construct(e, [], t);
      } else {
        try {
          t.call();
        } catch (c) {
          r = c;
        }
        e.call(t.prototype);
      }
    else {
      try {
        throw Error();
      } catch (c) {
        r = c;
      }
      e();
    }
  } catch (c) {
    if (c && r && typeof c.stack == 'string') {
      for (
        var l = c.stack.split(`
`),
          i = r.stack.split(`
`),
          o = l.length - 1,
          u = i.length - 1;
        1 <= o && 0 <= u && l[o] !== i[u];
      )
        u--;
      for (; 1 <= o && 0 <= u; o--, u--)
        if (l[o] !== i[u]) {
          if (o !== 1 || u !== 1)
            do
              if ((o--, u--, 0 > u || l[o] !== i[u])) {
                var s =
                  `
` + l[o].replace(' at new ', ' at ');
                return (
                  e.displayName &&
                    s.includes('<anonymous>') &&
                    (s = s.replace('<anonymous>', e.displayName)),
                  s
                );
              }
            while (1 <= o && 0 <= u);
          break;
        }
    }
  } finally {
    ((xl = !1), (Error.prepareStackTrace = n));
  }
  return (e = e ? e.displayName || e.name : '') ? wn(e) : '';
}
function jc(e) {
  switch (e.tag) {
    case 5:
      return wn(e.type);
    case 16:
      return wn('Lazy');
    case 13:
      return wn('Suspense');
    case 19:
      return wn('SuspenseList');
    case 0:
    case 2:
    case 15:
      return ((e = El(e.type, !1)), e);
    case 11:
      return ((e = El(e.type.render, !1)), e);
    case 1:
      return ((e = El(e.type, !0)), e);
    default:
      return '';
  }
}
function Zl(e) {
  if (e == null) return null;
  if (typeof e == 'function') return e.displayName || e.name || null;
  if (typeof e == 'string') return e;
  switch (e) {
    case Ot:
      return 'Fragment';
    case It:
      return 'Portal';
    case Yl:
      return 'Profiler';
    case Qi:
      return 'StrictMode';
    case Xl:
      return 'Suspense';
    case Gl:
      return 'SuspenseList';
  }
  if (typeof e == 'object')
    switch (e.$$typeof) {
      case rs:
        return (e.displayName || 'Context') + '.Consumer';
      case ns:
        return (e._context.displayName || 'Context') + '.Provider';
      case Ki:
        var t = e.render;
        return (
          (e = e.displayName),
          e ||
            ((e = t.displayName || t.name || ''),
            (e = e !== '' ? 'ForwardRef(' + e + ')' : 'ForwardRef')),
          e
        );
      case Yi:
        return (
          (t = e.displayName || null),
          t !== null ? t : Zl(e.type) || 'Memo'
        );
      case qe:
        ((t = e._payload), (e = e._init));
        try {
          return Zl(e(t));
        } catch {}
    }
  return null;
}
function Pc(e) {
  var t = e.type;
  switch (e.tag) {
    case 24:
      return 'Cache';
    case 9:
      return (t.displayName || 'Context') + '.Consumer';
    case 10:
      return (t._context.displayName || 'Context') + '.Provider';
    case 18:
      return 'DehydratedFragment';
    case 11:
      return (
        (e = t.render),
        (e = e.displayName || e.name || ''),
        t.displayName || (e !== '' ? 'ForwardRef(' + e + ')' : 'ForwardRef')
      );
    case 7:
      return 'Fragment';
    case 5:
      return t;
    case 4:
      return 'Portal';
    case 3:
      return 'Root';
    case 6:
      return 'Text';
    case 16:
      return Zl(t);
    case 8:
      return t === Qi ? 'StrictMode' : 'Mode';
    case 22:
      return 'Offscreen';
    case 12:
      return 'Profiler';
    case 21:
      return 'Scope';
    case 13:
      return 'Suspense';
    case 19:
      return 'SuspenseList';
    case 25:
      return 'TracingMarker';
    case 1:
    case 0:
    case 17:
    case 2:
    case 14:
    case 15:
      if (typeof t == 'function') return t.displayName || t.name || null;
      if (typeof t == 'string') return t;
  }
  return null;
}
function dt(e) {
  switch (typeof e) {
    case 'boolean':
    case 'number':
    case 'string':
    case 'undefined':
      return e;
    case 'object':
      return e;
    default:
      return '';
  }
}
function is(e) {
  var t = e.type;
  return (
    (e = e.nodeName) &&
    e.toLowerCase() === 'input' &&
    (t === 'checkbox' || t === 'radio')
  );
}
function zc(e) {
  var t = is(e) ? 'checked' : 'value',
    n = Object.getOwnPropertyDescriptor(e.constructor.prototype, t),
    r = '' + e[t];
  if (
    !e.hasOwnProperty(t) &&
    typeof n < 'u' &&
    typeof n.get == 'function' &&
    typeof n.set == 'function'
  ) {
    var l = n.get,
      i = n.set;
    return (
      Object.defineProperty(e, t, {
        configurable: !0,
        get: function () {
          return l.call(this);
        },
        set: function (o) {
          ((r = '' + o), i.call(this, o));
        },
      }),
      Object.defineProperty(e, t, { enumerable: n.enumerable }),
      {
        getValue: function () {
          return r;
        },
        setValue: function (o) {
          r = '' + o;
        },
        stopTracking: function () {
          ((e._valueTracker = null), delete e[t]);
        },
      }
    );
  }
}
function lr(e) {
  e._valueTracker || (e._valueTracker = zc(e));
}
function os(e) {
  if (!e) return !1;
  var t = e._valueTracker;
  if (!t) return !0;
  var n = t.getValue(),
    r = '';
  return (
    e && (r = is(e) ? (e.checked ? 'true' : 'false') : e.value),
    (e = r),
    e !== n ? (t.setValue(e), !0) : !1
  );
}
function Tr(e) {
  if (((e = e || (typeof document < 'u' ? document : void 0)), typeof e > 'u'))
    return null;
  try {
    return e.activeElement || e.body;
  } catch {
    return e.body;
  }
}
function Jl(e, t) {
  var n = t.checked;
  return V({}, t, {
    defaultChecked: void 0,
    defaultValue: void 0,
    value: void 0,
    checked: n ?? e._wrapperState.initialChecked,
  });
}
function $o(e, t) {
  var n = t.defaultValue == null ? '' : t.defaultValue,
    r = t.checked != null ? t.checked : t.defaultChecked;
  ((n = dt(t.value != null ? t.value : n)),
    (e._wrapperState = {
      initialChecked: r,
      initialValue: n,
      controlled:
        t.type === 'checkbox' || t.type === 'radio'
          ? t.checked != null
          : t.value != null,
    }));
}
function us(e, t) {
  ((t = t.checked), t != null && Hi(e, 'checked', t, !1));
}
function ql(e, t) {
  us(e, t);
  var n = dt(t.value),
    r = t.type;
  if (n != null)
    r === 'number'
      ? ((n === 0 && e.value === '') || e.value != n) && (e.value = '' + n)
      : e.value !== '' + n && (e.value = '' + n);
  else if (r === 'submit' || r === 'reset') {
    e.removeAttribute('value');
    return;
  }
  (t.hasOwnProperty('value')
    ? bl(e, t.type, n)
    : t.hasOwnProperty('defaultValue') && bl(e, t.type, dt(t.defaultValue)),
    t.checked == null &&
      t.defaultChecked != null &&
      (e.defaultChecked = !!t.defaultChecked));
}
function Bo(e, t, n) {
  if (t.hasOwnProperty('value') || t.hasOwnProperty('defaultValue')) {
    var r = t.type;
    if (
      !(
        (r !== 'submit' && r !== 'reset') ||
        (t.value !== void 0 && t.value !== null)
      )
    )
      return;
    ((t = '' + e._wrapperState.initialValue),
      n || t === e.value || (e.value = t),
      (e.defaultValue = t));
  }
  ((n = e.name),
    n !== '' && (e.name = ''),
    (e.defaultChecked = !!e._wrapperState.initialChecked),
    n !== '' && (e.name = n));
}
function bl(e, t, n) {
  (t !== 'number' || Tr(e.ownerDocument) !== e) &&
    (n == null
      ? (e.defaultValue = '' + e._wrapperState.initialValue)
      : e.defaultValue !== '' + n && (e.defaultValue = '' + n));
}
var kn = Array.isArray;
function Kt(e, t, n, r) {
  if (((e = e.options), t)) {
    t = {};
    for (var l = 0; l < n.length; l++) t['$' + n[l]] = !0;
    for (n = 0; n < e.length; n++)
      ((l = t.hasOwnProperty('$' + e[n].value)),
        e[n].selected !== l && (e[n].selected = l),
        l && r && (e[n].defaultSelected = !0));
  } else {
    for (n = '' + dt(n), t = null, l = 0; l < e.length; l++) {
      if (e[l].value === n) {
        ((e[l].selected = !0), r && (e[l].defaultSelected = !0));
        return;
      }
      t !== null || e[l].disabled || (t = e[l]);
    }
    t !== null && (t.selected = !0);
  }
}
function ei(e, t) {
  if (t.dangerouslySetInnerHTML != null) throw Error(g(91));
  return V({}, t, {
    value: void 0,
    defaultValue: void 0,
    children: '' + e._wrapperState.initialValue,
  });
}
function Vo(e, t) {
  var n = t.value;
  if (n == null) {
    if (((n = t.children), (t = t.defaultValue), n != null)) {
      if (t != null) throw Error(g(92));
      if (kn(n)) {
        if (1 < n.length) throw Error(g(93));
        n = n[0];
      }
      t = n;
    }
    (t == null && (t = ''), (n = t));
  }
  e._wrapperState = { initialValue: dt(n) };
}
function ss(e, t) {
  var n = dt(t.value),
    r = dt(t.defaultValue);
  (n != null &&
    ((n = '' + n),
    n !== e.value && (e.value = n),
    t.defaultValue == null && e.defaultValue !== n && (e.defaultValue = n)),
    r != null && (e.defaultValue = '' + r));
}
function Wo(e) {
  var t = e.textContent;
  t === e._wrapperState.initialValue && t !== '' && t !== null && (e.value = t);
}
function as(e) {
  switch (e) {
    case 'svg':
      return 'http://www.w3.org/2000/svg';
    case 'math':
      return 'http://www.w3.org/1998/Math/MathML';
    default:
      return 'http://www.w3.org/1999/xhtml';
  }
}
function ti(e, t) {
  return e == null || e === 'http://www.w3.org/1999/xhtml'
    ? as(t)
    : e === 'http://www.w3.org/2000/svg' && t === 'foreignObject'
      ? 'http://www.w3.org/1999/xhtml'
      : e;
}
var ir,
  cs = (function (e) {
    return typeof MSApp < 'u' && MSApp.execUnsafeLocalFunction
      ? function (t, n, r, l) {
          MSApp.execUnsafeLocalFunction(function () {
            return e(t, n, r, l);
          });
        }
      : e;
  })(function (e, t) {
    if (e.namespaceURI !== 'http://www.w3.org/2000/svg' || 'innerHTML' in e)
      e.innerHTML = t;
    else {
      for (
        ir = ir || document.createElement('div'),
          ir.innerHTML = '<svg>' + t.valueOf().toString() + '</svg>',
          t = ir.firstChild;
        e.firstChild;
      )
        e.removeChild(e.firstChild);
      for (; t.firstChild; ) e.appendChild(t.firstChild);
    }
  });
function Mn(e, t) {
  if (t) {
    var n = e.firstChild;
    if (n && n === e.lastChild && n.nodeType === 3) {
      n.nodeValue = t;
      return;
    }
  }
  e.textContent = t;
}
var En = {
    animationIterationCount: !0,
    aspectRatio: !0,
    borderImageOutset: !0,
    borderImageSlice: !0,
    borderImageWidth: !0,
    boxFlex: !0,
    boxFlexGroup: !0,
    boxOrdinalGroup: !0,
    columnCount: !0,
    columns: !0,
    flex: !0,
    flexGrow: !0,
    flexPositive: !0,
    flexShrink: !0,
    flexNegative: !0,
    flexOrder: !0,
    gridArea: !0,
    gridRow: !0,
    gridRowEnd: !0,
    gridRowSpan: !0,
    gridRowStart: !0,
    gridColumn: !0,
    gridColumnEnd: !0,
    gridColumnSpan: !0,
    gridColumnStart: !0,
    fontWeight: !0,
    lineClamp: !0,
    lineHeight: !0,
    opacity: !0,
    order: !0,
    orphans: !0,
    tabSize: !0,
    widows: !0,
    zIndex: !0,
    zoom: !0,
    fillOpacity: !0,
    floodOpacity: !0,
    stopOpacity: !0,
    strokeDasharray: !0,
    strokeDashoffset: !0,
    strokeMiterlimit: !0,
    strokeOpacity: !0,
    strokeWidth: !0,
  },
  Lc = ['Webkit', 'ms', 'Moz', 'O'];
Object.keys(En).forEach(function (e) {
  Lc.forEach(function (t) {
    ((t = t + e.charAt(0).toUpperCase() + e.substring(1)), (En[t] = En[e]));
  });
});
function fs(e, t, n) {
  return t == null || typeof t == 'boolean' || t === ''
    ? ''
    : n || typeof t != 'number' || t === 0 || (En.hasOwnProperty(e) && En[e])
      ? ('' + t).trim()
      : t + 'px';
}
function ds(e, t) {
  e = e.style;
  for (var n in t)
    if (t.hasOwnProperty(n)) {
      var r = n.indexOf('--') === 0,
        l = fs(n, t[n], r);
      (n === 'float' && (n = 'cssFloat'), r ? e.setProperty(n, l) : (e[n] = l));
    }
}
var Tc = V(
  { menuitem: !0 },
  {
    area: !0,
    base: !0,
    br: !0,
    col: !0,
    embed: !0,
    hr: !0,
    img: !0,
    input: !0,
    keygen: !0,
    link: !0,
    meta: !0,
    param: !0,
    source: !0,
    track: !0,
    wbr: !0,
  },
);
function ni(e, t) {
  if (t) {
    if (Tc[e] && (t.children != null || t.dangerouslySetInnerHTML != null))
      throw Error(g(137, e));
    if (t.dangerouslySetInnerHTML != null) {
      if (t.children != null) throw Error(g(60));
      if (
        typeof t.dangerouslySetInnerHTML != 'object' ||
        !('__html' in t.dangerouslySetInnerHTML)
      )
        throw Error(g(61));
    }
    if (t.style != null && typeof t.style != 'object') throw Error(g(62));
  }
}
function ri(e, t) {
  if (e.indexOf('-') === -1) return typeof t.is == 'string';
  switch (e) {
    case 'annotation-xml':
    case 'color-profile':
    case 'font-face':
    case 'font-face-src':
    case 'font-face-uri':
    case 'font-face-format':
    case 'font-face-name':
    case 'missing-glyph':
      return !1;
    default:
      return !0;
  }
}
var li = null;
function Xi(e) {
  return (
    (e = e.target || e.srcElement || window),
    e.correspondingUseElement && (e = e.correspondingUseElement),
    e.nodeType === 3 ? e.parentNode : e
  );
}
var ii = null,
  Yt = null,
  Xt = null;
function Ho(e) {
  if ((e = qn(e))) {
    if (typeof ii != 'function') throw Error(g(280));
    var t = e.stateNode;
    t && ((t = il(t)), ii(e.stateNode, e.type, t));
  }
}
function ps(e) {
  Yt ? (Xt ? Xt.push(e) : (Xt = [e])) : (Yt = e);
}
function hs() {
  if (Yt) {
    var e = Yt,
      t = Xt;
    if (((Xt = Yt = null), Ho(e), t)) for (e = 0; e < t.length; e++) Ho(t[e]);
  }
}
function ms(e, t) {
  return e(t);
}
function vs() {}
var Nl = !1;
function ys(e, t, n) {
  if (Nl) return e(t, n);
  Nl = !0;
  try {
    return ms(e, t, n);
  } finally {
    ((Nl = !1), (Yt !== null || Xt !== null) && (vs(), hs()));
  }
}
function In(e, t) {
  var n = e.stateNode;
  if (n === null) return null;
  var r = il(n);
  if (r === null) return null;
  n = r[t];
  e: switch (t) {
    case 'onClick':
    case 'onClickCapture':
    case 'onDoubleClick':
    case 'onDoubleClickCapture':
    case 'onMouseDown':
    case 'onMouseDownCapture':
    case 'onMouseMove':
    case 'onMouseMoveCapture':
    case 'onMouseUp':
    case 'onMouseUpCapture':
    case 'onMouseEnter':
      ((r = !r.disabled) ||
        ((e = e.type),
        (r = !(
          e === 'button' ||
          e === 'input' ||
          e === 'select' ||
          e === 'textarea'
        ))),
        (e = !r));
      break e;
    default:
      e = !1;
  }
  if (e) return null;
  if (n && typeof n != 'function') throw Error(g(231, t, typeof n));
  return n;
}
var oi = !1;
if (Ke)
  try {
    var dn = {};
    (Object.defineProperty(dn, 'passive', {
      get: function () {
        oi = !0;
      },
    }),
      window.addEventListener('test', dn, dn),
      window.removeEventListener('test', dn, dn));
  } catch {
    oi = !1;
  }
function Rc(e, t, n, r, l, i, o, u, s) {
  var c = Array.prototype.slice.call(arguments, 3);
  try {
    t.apply(n, c);
  } catch (v) {
    this.onError(v);
  }
}
var Nn = !1,
  Rr = null,
  Mr = !1,
  ui = null,
  Mc = {
    onError: function (e) {
      ((Nn = !0), (Rr = e));
    },
  };
function Ic(e, t, n, r, l, i, o, u, s) {
  ((Nn = !1), (Rr = null), Rc.apply(Mc, arguments));
}
function Oc(e, t, n, r, l, i, o, u, s) {
  if ((Ic.apply(this, arguments), Nn)) {
    if (Nn) {
      var c = Rr;
      ((Nn = !1), (Rr = null));
    } else throw Error(g(198));
    Mr || ((Mr = !0), (ui = c));
  }
}
function Rt(e) {
  var t = e,
    n = e;
  if (e.alternate) for (; t.return; ) t = t.return;
  else {
    e = t;
    do ((t = e), t.flags & 4098 && (n = t.return), (e = t.return));
    while (e);
  }
  return t.tag === 3 ? n : null;
}
function gs(e) {
  if (e.tag === 13) {
    var t = e.memoizedState;
    if (
      (t === null && ((e = e.alternate), e !== null && (t = e.memoizedState)),
      t !== null)
    )
      return t.dehydrated;
  }
  return null;
}
function Qo(e) {
  if (Rt(e) !== e) throw Error(g(188));
}
function Dc(e) {
  var t = e.alternate;
  if (!t) {
    if (((t = Rt(e)), t === null)) throw Error(g(188));
    return t !== e ? null : e;
  }
  for (var n = e, r = t; ; ) {
    var l = n.return;
    if (l === null) break;
    var i = l.alternate;
    if (i === null) {
      if (((r = l.return), r !== null)) {
        n = r;
        continue;
      }
      break;
    }
    if (l.child === i.child) {
      for (i = l.child; i; ) {
        if (i === n) return (Qo(l), e);
        if (i === r) return (Qo(l), t);
        i = i.sibling;
      }
      throw Error(g(188));
    }
    if (n.return !== r.return) ((n = l), (r = i));
    else {
      for (var o = !1, u = l.child; u; ) {
        if (u === n) {
          ((o = !0), (n = l), (r = i));
          break;
        }
        if (u === r) {
          ((o = !0), (r = l), (n = i));
          break;
        }
        u = u.sibling;
      }
      if (!o) {
        for (u = i.child; u; ) {
          if (u === n) {
            ((o = !0), (n = i), (r = l));
            break;
          }
          if (u === r) {
            ((o = !0), (r = i), (n = l));
            break;
          }
          u = u.sibling;
        }
        if (!o) throw Error(g(189));
      }
    }
    if (n.alternate !== r) throw Error(g(190));
  }
  if (n.tag !== 3) throw Error(g(188));
  return n.stateNode.current === n ? e : t;
}
function ws(e) {
  return ((e = Dc(e)), e !== null ? ks(e) : null);
}
function ks(e) {
  if (e.tag === 5 || e.tag === 6) return e;
  for (e = e.child; e !== null; ) {
    var t = ks(e);
    if (t !== null) return t;
    e = e.sibling;
  }
  return null;
}
var Ss = ge.unstable_scheduleCallback,
  Ko = ge.unstable_cancelCallback,
  Fc = ge.unstable_shouldYield,
  Uc = ge.unstable_requestPaint,
  Q = ge.unstable_now,
  Ac = ge.unstable_getCurrentPriorityLevel,
  Gi = ge.unstable_ImmediatePriority,
  xs = ge.unstable_UserBlockingPriority,
  Ir = ge.unstable_NormalPriority,
  $c = ge.unstable_LowPriority,
  Es = ge.unstable_IdlePriority,
  tl = null,
  Ae = null;
function Bc(e) {
  if (Ae && typeof Ae.onCommitFiberRoot == 'function')
    try {
      Ae.onCommitFiberRoot(tl, e, void 0, (e.current.flags & 128) === 128);
    } catch {}
}
var Re = Math.clz32 ? Math.clz32 : Hc,
  Vc = Math.log,
  Wc = Math.LN2;
function Hc(e) {
  return ((e >>>= 0), e === 0 ? 32 : (31 - ((Vc(e) / Wc) | 0)) | 0);
}
var or = 64,
  ur = 4194304;
function Sn(e) {
  switch (e & -e) {
    case 1:
      return 1;
    case 2:
      return 2;
    case 4:
      return 4;
    case 8:
      return 8;
    case 16:
      return 16;
    case 32:
      return 32;
    case 64:
    case 128:
    case 256:
    case 512:
    case 1024:
    case 2048:
    case 4096:
    case 8192:
    case 16384:
    case 32768:
    case 65536:
    case 131072:
    case 262144:
    case 524288:
    case 1048576:
    case 2097152:
      return e & 4194240;
    case 4194304:
    case 8388608:
    case 16777216:
    case 33554432:
    case 67108864:
      return e & 130023424;
    case 134217728:
      return 134217728;
    case 268435456:
      return 268435456;
    case 536870912:
      return 536870912;
    case 1073741824:
      return 1073741824;
    default:
      return e;
  }
}
function Or(e, t) {
  var n = e.pendingLanes;
  if (n === 0) return 0;
  var r = 0,
    l = e.suspendedLanes,
    i = e.pingedLanes,
    o = n & 268435455;
  if (o !== 0) {
    var u = o & ~l;
    u !== 0 ? (r = Sn(u)) : ((i &= o), i !== 0 && (r = Sn(i)));
  } else ((o = n & ~l), o !== 0 ? (r = Sn(o)) : i !== 0 && (r = Sn(i)));
  if (r === 0) return 0;
  if (
    t !== 0 &&
    t !== r &&
    !(t & l) &&
    ((l = r & -r), (i = t & -t), l >= i || (l === 16 && (i & 4194240) !== 0))
  )
    return t;
  if ((r & 4 && (r |= n & 16), (t = e.entangledLanes), t !== 0))
    for (e = e.entanglements, t &= r; 0 < t; )
      ((n = 31 - Re(t)), (l = 1 << n), (r |= e[n]), (t &= ~l));
  return r;
}
function Qc(e, t) {
  switch (e) {
    case 1:
    case 2:
    case 4:
      return t + 250;
    case 8:
    case 16:
    case 32:
    case 64:
    case 128:
    case 256:
    case 512:
    case 1024:
    case 2048:
    case 4096:
    case 8192:
    case 16384:
    case 32768:
    case 65536:
    case 131072:
    case 262144:
    case 524288:
    case 1048576:
    case 2097152:
      return t + 5e3;
    case 4194304:
    case 8388608:
    case 16777216:
    case 33554432:
    case 67108864:
      return -1;
    case 134217728:
    case 268435456:
    case 536870912:
    case 1073741824:
      return -1;
    default:
      return -1;
  }
}
function Kc(e, t) {
  for (
    var n = e.suspendedLanes,
      r = e.pingedLanes,
      l = e.expirationTimes,
      i = e.pendingLanes;
    0 < i;
  ) {
    var o = 31 - Re(i),
      u = 1 << o,
      s = l[o];
    (s === -1
      ? (!(u & n) || u & r) && (l[o] = Qc(u, t))
      : s <= t && (e.expiredLanes |= u),
      (i &= ~u));
  }
}
function si(e) {
  return (
    (e = e.pendingLanes & -1073741825),
    e !== 0 ? e : e & 1073741824 ? 1073741824 : 0
  );
}
function Ns() {
  var e = or;
  return ((or <<= 1), !(or & 4194240) && (or = 64), e);
}
function Cl(e) {
  for (var t = [], n = 0; 31 > n; n++) t.push(e);
  return t;
}
function Zn(e, t, n) {
  ((e.pendingLanes |= t),
    t !== 536870912 && ((e.suspendedLanes = 0), (e.pingedLanes = 0)),
    (e = e.eventTimes),
    (t = 31 - Re(t)),
    (e[t] = n));
}
function Yc(e, t) {
  var n = e.pendingLanes & ~t;
  ((e.pendingLanes = t),
    (e.suspendedLanes = 0),
    (e.pingedLanes = 0),
    (e.expiredLanes &= t),
    (e.mutableReadLanes &= t),
    (e.entangledLanes &= t),
    (t = e.entanglements));
  var r = e.eventTimes;
  for (e = e.expirationTimes; 0 < n; ) {
    var l = 31 - Re(n),
      i = 1 << l;
    ((t[l] = 0), (r[l] = -1), (e[l] = -1), (n &= ~i));
  }
}
function Zi(e, t) {
  var n = (e.entangledLanes |= t);
  for (e = e.entanglements; n; ) {
    var r = 31 - Re(n),
      l = 1 << r;
    ((l & t) | (e[r] & t) && (e[r] |= t), (n &= ~l));
  }
}
var I = 0;
function Cs(e) {
  return (
    (e &= -e),
    1 < e ? (4 < e ? (e & 268435455 ? 16 : 536870912) : 4) : 1
  );
}
var _s,
  Ji,
  js,
  Ps,
  zs,
  ai = !1,
  sr = [],
  lt = null,
  it = null,
  ot = null,
  On = new Map(),
  Dn = new Map(),
  et = [],
  Xc =
    'mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset submit'.split(
      ' ',
    );
function Yo(e, t) {
  switch (e) {
    case 'focusin':
    case 'focusout':
      lt = null;
      break;
    case 'dragenter':
    case 'dragleave':
      it = null;
      break;
    case 'mouseover':
    case 'mouseout':
      ot = null;
      break;
    case 'pointerover':
    case 'pointerout':
      On.delete(t.pointerId);
      break;
    case 'gotpointercapture':
    case 'lostpointercapture':
      Dn.delete(t.pointerId);
  }
}
function pn(e, t, n, r, l, i) {
  return e === null || e.nativeEvent !== i
    ? ((e = {
        blockedOn: t,
        domEventName: n,
        eventSystemFlags: r,
        nativeEvent: i,
        targetContainers: [l],
      }),
      t !== null && ((t = qn(t)), t !== null && Ji(t)),
      e)
    : ((e.eventSystemFlags |= r),
      (t = e.targetContainers),
      l !== null && t.indexOf(l) === -1 && t.push(l),
      e);
}
function Gc(e, t, n, r, l) {
  switch (t) {
    case 'focusin':
      return ((lt = pn(lt, e, t, n, r, l)), !0);
    case 'dragenter':
      return ((it = pn(it, e, t, n, r, l)), !0);
    case 'mouseover':
      return ((ot = pn(ot, e, t, n, r, l)), !0);
    case 'pointerover':
      var i = l.pointerId;
      return (On.set(i, pn(On.get(i) || null, e, t, n, r, l)), !0);
    case 'gotpointercapture':
      return (
        (i = l.pointerId),
        Dn.set(i, pn(Dn.get(i) || null, e, t, n, r, l)),
        !0
      );
  }
  return !1;
}
function Ls(e) {
  var t = St(e.target);
  if (t !== null) {
    var n = Rt(t);
    if (n !== null) {
      if (((t = n.tag), t === 13)) {
        if (((t = gs(n)), t !== null)) {
          ((e.blockedOn = t),
            zs(e.priority, function () {
              js(n);
            }));
          return;
        }
      } else if (t === 3 && n.stateNode.current.memoizedState.isDehydrated) {
        e.blockedOn = n.tag === 3 ? n.stateNode.containerInfo : null;
        return;
      }
    }
  }
  e.blockedOn = null;
}
function Sr(e) {
  if (e.blockedOn !== null) return !1;
  for (var t = e.targetContainers; 0 < t.length; ) {
    var n = ci(e.domEventName, e.eventSystemFlags, t[0], e.nativeEvent);
    if (n === null) {
      n = e.nativeEvent;
      var r = new n.constructor(n.type, n);
      ((li = r), n.target.dispatchEvent(r), (li = null));
    } else return ((t = qn(n)), t !== null && Ji(t), (e.blockedOn = n), !1);
    t.shift();
  }
  return !0;
}
function Xo(e, t, n) {
  Sr(e) && n.delete(t);
}
function Zc() {
  ((ai = !1),
    lt !== null && Sr(lt) && (lt = null),
    it !== null && Sr(it) && (it = null),
    ot !== null && Sr(ot) && (ot = null),
    On.forEach(Xo),
    Dn.forEach(Xo));
}
function hn(e, t) {
  e.blockedOn === t &&
    ((e.blockedOn = null),
    ai ||
      ((ai = !0),
      ge.unstable_scheduleCallback(ge.unstable_NormalPriority, Zc)));
}
function Fn(e) {
  function t(l) {
    return hn(l, e);
  }
  if (0 < sr.length) {
    hn(sr[0], e);
    for (var n = 1; n < sr.length; n++) {
      var r = sr[n];
      r.blockedOn === e && (r.blockedOn = null);
    }
  }
  for (
    lt !== null && hn(lt, e),
      it !== null && hn(it, e),
      ot !== null && hn(ot, e),
      On.forEach(t),
      Dn.forEach(t),
      n = 0;
    n < et.length;
    n++
  )
    ((r = et[n]), r.blockedOn === e && (r.blockedOn = null));
  for (; 0 < et.length && ((n = et[0]), n.blockedOn === null); )
    (Ls(n), n.blockedOn === null && et.shift());
}
var Gt = Ze.ReactCurrentBatchConfig,
  Dr = !0;
function Jc(e, t, n, r) {
  var l = I,
    i = Gt.transition;
  Gt.transition = null;
  try {
    ((I = 1), qi(e, t, n, r));
  } finally {
    ((I = l), (Gt.transition = i));
  }
}
function qc(e, t, n, r) {
  var l = I,
    i = Gt.transition;
  Gt.transition = null;
  try {
    ((I = 4), qi(e, t, n, r));
  } finally {
    ((I = l), (Gt.transition = i));
  }
}
function qi(e, t, n, r) {
  if (Dr) {
    var l = ci(e, t, n, r);
    if (l === null) (Ol(e, t, r, Fr, n), Yo(e, r));
    else if (Gc(l, e, t, n, r)) r.stopPropagation();
    else if ((Yo(e, r), t & 4 && -1 < Xc.indexOf(e))) {
      for (; l !== null; ) {
        var i = qn(l);
        if (
          (i !== null && _s(i),
          (i = ci(e, t, n, r)),
          i === null && Ol(e, t, r, Fr, n),
          i === l)
        )
          break;
        l = i;
      }
      l !== null && r.stopPropagation();
    } else Ol(e, t, r, null, n);
  }
}
var Fr = null;
function ci(e, t, n, r) {
  if (((Fr = null), (e = Xi(r)), (e = St(e)), e !== null))
    if (((t = Rt(e)), t === null)) e = null;
    else if (((n = t.tag), n === 13)) {
      if (((e = gs(t)), e !== null)) return e;
      e = null;
    } else if (n === 3) {
      if (t.stateNode.current.memoizedState.isDehydrated)
        return t.tag === 3 ? t.stateNode.containerInfo : null;
      e = null;
    } else t !== e && (e = null);
  return ((Fr = e), null);
}
function Ts(e) {
  switch (e) {
    case 'cancel':
    case 'click':
    case 'close':
    case 'contextmenu':
    case 'copy':
    case 'cut':
    case 'auxclick':
    case 'dblclick':
    case 'dragend':
    case 'dragstart':
    case 'drop':
    case 'focusin':
    case 'focusout':
    case 'input':
    case 'invalid':
    case 'keydown':
    case 'keypress':
    case 'keyup':
    case 'mousedown':
    case 'mouseup':
    case 'paste':
    case 'pause':
    case 'play':
    case 'pointercancel':
    case 'pointerdown':
    case 'pointerup':
    case 'ratechange':
    case 'reset':
    case 'resize':
    case 'seeked':
    case 'submit':
    case 'touchcancel':
    case 'touchend':
    case 'touchstart':
    case 'volumechange':
    case 'change':
    case 'selectionchange':
    case 'textInput':
    case 'compositionstart':
    case 'compositionend':
    case 'compositionupdate':
    case 'beforeblur':
    case 'afterblur':
    case 'beforeinput':
    case 'blur':
    case 'fullscreenchange':
    case 'focus':
    case 'hashchange':
    case 'popstate':
    case 'select':
    case 'selectstart':
      return 1;
    case 'drag':
    case 'dragenter':
    case 'dragexit':
    case 'dragleave':
    case 'dragover':
    case 'mousemove':
    case 'mouseout':
    case 'mouseover':
    case 'pointermove':
    case 'pointerout':
    case 'pointerover':
    case 'scroll':
    case 'toggle':
    case 'touchmove':
    case 'wheel':
    case 'mouseenter':
    case 'mouseleave':
    case 'pointerenter':
    case 'pointerleave':
      return 4;
    case 'message':
      switch (Ac()) {
        case Gi:
          return 1;
        case xs:
          return 4;
        case Ir:
        case $c:
          return 16;
        case Es:
          return 536870912;
        default:
          return 16;
      }
    default:
      return 16;
  }
}
var nt = null,
  bi = null,
  xr = null;
function Rs() {
  if (xr) return xr;
  var e,
    t = bi,
    n = t.length,
    r,
    l = 'value' in nt ? nt.value : nt.textContent,
    i = l.length;
  for (e = 0; e < n && t[e] === l[e]; e++);
  var o = n - e;
  for (r = 1; r <= o && t[n - r] === l[i - r]; r++);
  return (xr = l.slice(e, 1 < r ? 1 - r : void 0));
}
function Er(e) {
  var t = e.keyCode;
  return (
    'charCode' in e
      ? ((e = e.charCode), e === 0 && t === 13 && (e = 13))
      : (e = t),
    e === 10 && (e = 13),
    32 <= e || e === 13 ? e : 0
  );
}
function ar() {
  return !0;
}
function Go() {
  return !1;
}
function ke(e) {
  function t(n, r, l, i, o) {
    ((this._reactName = n),
      (this._targetInst = l),
      (this.type = r),
      (this.nativeEvent = i),
      (this.target = o),
      (this.currentTarget = null));
    for (var u in e)
      e.hasOwnProperty(u) && ((n = e[u]), (this[u] = n ? n(i) : i[u]));
    return (
      (this.isDefaultPrevented = (
        i.defaultPrevented != null ? i.defaultPrevented : i.returnValue === !1
      )
        ? ar
        : Go),
      (this.isPropagationStopped = Go),
      this
    );
  }
  return (
    V(t.prototype, {
      preventDefault: function () {
        this.defaultPrevented = !0;
        var n = this.nativeEvent;
        n &&
          (n.preventDefault
            ? n.preventDefault()
            : typeof n.returnValue != 'unknown' && (n.returnValue = !1),
          (this.isDefaultPrevented = ar));
      },
      stopPropagation: function () {
        var n = this.nativeEvent;
        n &&
          (n.stopPropagation
            ? n.stopPropagation()
            : typeof n.cancelBubble != 'unknown' && (n.cancelBubble = !0),
          (this.isPropagationStopped = ar));
      },
      persist: function () {},
      isPersistent: ar,
    }),
    t
  );
}
var un = {
    eventPhase: 0,
    bubbles: 0,
    cancelable: 0,
    timeStamp: function (e) {
      return e.timeStamp || Date.now();
    },
    defaultPrevented: 0,
    isTrusted: 0,
  },
  eo = ke(un),
  Jn = V({}, un, { view: 0, detail: 0 }),
  bc = ke(Jn),
  _l,
  jl,
  mn,
  nl = V({}, Jn, {
    screenX: 0,
    screenY: 0,
    clientX: 0,
    clientY: 0,
    pageX: 0,
    pageY: 0,
    ctrlKey: 0,
    shiftKey: 0,
    altKey: 0,
    metaKey: 0,
    getModifierState: to,
    button: 0,
    buttons: 0,
    relatedTarget: function (e) {
      return e.relatedTarget === void 0
        ? e.fromElement === e.srcElement
          ? e.toElement
          : e.fromElement
        : e.relatedTarget;
    },
    movementX: function (e) {
      return 'movementX' in e
        ? e.movementX
        : (e !== mn &&
            (mn && e.type === 'mousemove'
              ? ((_l = e.screenX - mn.screenX), (jl = e.screenY - mn.screenY))
              : (jl = _l = 0),
            (mn = e)),
          _l);
    },
    movementY: function (e) {
      return 'movementY' in e ? e.movementY : jl;
    },
  }),
  Zo = ke(nl),
  ef = V({}, nl, { dataTransfer: 0 }),
  tf = ke(ef),
  nf = V({}, Jn, { relatedTarget: 0 }),
  Pl = ke(nf),
  rf = V({}, un, { animationName: 0, elapsedTime: 0, pseudoElement: 0 }),
  lf = ke(rf),
  of = V({}, un, {
    clipboardData: function (e) {
      return 'clipboardData' in e ? e.clipboardData : window.clipboardData;
    },
  }),
  uf = ke(of),
  sf = V({}, un, { data: 0 }),
  Jo = ke(sf),
  af = {
    Esc: 'Escape',
    Spacebar: ' ',
    Left: 'ArrowLeft',
    Up: 'ArrowUp',
    Right: 'ArrowRight',
    Down: 'ArrowDown',
    Del: 'Delete',
    Win: 'OS',
    Menu: 'ContextMenu',
    Apps: 'ContextMenu',
    Scroll: 'ScrollLock',
    MozPrintableKey: 'Unidentified',
  },
  cf = {
    8: 'Backspace',
    9: 'Tab',
    12: 'Clear',
    13: 'Enter',
    16: 'Shift',
    17: 'Control',
    18: 'Alt',
    19: 'Pause',
    20: 'CapsLock',
    27: 'Escape',
    32: ' ',
    33: 'PageUp',
    34: 'PageDown',
    35: 'End',
    36: 'Home',
    37: 'ArrowLeft',
    38: 'ArrowUp',
    39: 'ArrowRight',
    40: 'ArrowDown',
    45: 'Insert',
    46: 'Delete',
    112: 'F1',
    113: 'F2',
    114: 'F3',
    115: 'F4',
    116: 'F5',
    117: 'F6',
    118: 'F7',
    119: 'F8',
    120: 'F9',
    121: 'F10',
    122: 'F11',
    123: 'F12',
    144: 'NumLock',
    145: 'ScrollLock',
    224: 'Meta',
  },
  ff = {
    Alt: 'altKey',
    Control: 'ctrlKey',
    Meta: 'metaKey',
    Shift: 'shiftKey',
  };
function df(e) {
  var t = this.nativeEvent;
  return t.getModifierState ? t.getModifierState(e) : (e = ff[e]) ? !!t[e] : !1;
}
function to() {
  return df;
}
var pf = V({}, Jn, {
    key: function (e) {
      if (e.key) {
        var t = af[e.key] || e.key;
        if (t !== 'Unidentified') return t;
      }
      return e.type === 'keypress'
        ? ((e = Er(e)), e === 13 ? 'Enter' : String.fromCharCode(e))
        : e.type === 'keydown' || e.type === 'keyup'
          ? cf[e.keyCode] || 'Unidentified'
          : '';
    },
    code: 0,
    location: 0,
    ctrlKey: 0,
    shiftKey: 0,
    altKey: 0,
    metaKey: 0,
    repeat: 0,
    locale: 0,
    getModifierState: to,
    charCode: function (e) {
      return e.type === 'keypress' ? Er(e) : 0;
    },
    keyCode: function (e) {
      return e.type === 'keydown' || e.type === 'keyup' ? e.keyCode : 0;
    },
    which: function (e) {
      return e.type === 'keypress'
        ? Er(e)
        : e.type === 'keydown' || e.type === 'keyup'
          ? e.keyCode
          : 0;
    },
  }),
  hf = ke(pf),
  mf = V({}, nl, {
    pointerId: 0,
    width: 0,
    height: 0,
    pressure: 0,
    tangentialPressure: 0,
    tiltX: 0,
    tiltY: 0,
    twist: 0,
    pointerType: 0,
    isPrimary: 0,
  }),
  qo = ke(mf),
  vf = V({}, Jn, {
    touches: 0,
    targetTouches: 0,
    changedTouches: 0,
    altKey: 0,
    metaKey: 0,
    ctrlKey: 0,
    shiftKey: 0,
    getModifierState: to,
  }),
  yf = ke(vf),
  gf = V({}, un, { propertyName: 0, elapsedTime: 0, pseudoElement: 0 }),
  wf = ke(gf),
  kf = V({}, nl, {
    deltaX: function (e) {
      return 'deltaX' in e ? e.deltaX : 'wheelDeltaX' in e ? -e.wheelDeltaX : 0;
    },
    deltaY: function (e) {
      return 'deltaY' in e
        ? e.deltaY
        : 'wheelDeltaY' in e
          ? -e.wheelDeltaY
          : 'wheelDelta' in e
            ? -e.wheelDelta
            : 0;
    },
    deltaZ: 0,
    deltaMode: 0,
  }),
  Sf = ke(kf),
  xf = [9, 13, 27, 32],
  no = Ke && 'CompositionEvent' in window,
  Cn = null;
Ke && 'documentMode' in document && (Cn = document.documentMode);
var Ef = Ke && 'TextEvent' in window && !Cn,
  Ms = Ke && (!no || (Cn && 8 < Cn && 11 >= Cn)),
  bo = ' ',
  eu = !1;
function Is(e, t) {
  switch (e) {
    case 'keyup':
      return xf.indexOf(t.keyCode) !== -1;
    case 'keydown':
      return t.keyCode !== 229;
    case 'keypress':
    case 'mousedown':
    case 'focusout':
      return !0;
    default:
      return !1;
  }
}
function Os(e) {
  return ((e = e.detail), typeof e == 'object' && 'data' in e ? e.data : null);
}
var Dt = !1;
function Nf(e, t) {
  switch (e) {
    case 'compositionend':
      return Os(t);
    case 'keypress':
      return t.which !== 32 ? null : ((eu = !0), bo);
    case 'textInput':
      return ((e = t.data), e === bo && eu ? null : e);
    default:
      return null;
  }
}
function Cf(e, t) {
  if (Dt)
    return e === 'compositionend' || (!no && Is(e, t))
      ? ((e = Rs()), (xr = bi = nt = null), (Dt = !1), e)
      : null;
  switch (e) {
    case 'paste':
      return null;
    case 'keypress':
      if (!(t.ctrlKey || t.altKey || t.metaKey) || (t.ctrlKey && t.altKey)) {
        if (t.char && 1 < t.char.length) return t.char;
        if (t.which) return String.fromCharCode(t.which);
      }
      return null;
    case 'compositionend':
      return Ms && t.locale !== 'ko' ? null : t.data;
    default:
      return null;
  }
}
var _f = {
  color: !0,
  date: !0,
  datetime: !0,
  'datetime-local': !0,
  email: !0,
  month: !0,
  number: !0,
  password: !0,
  range: !0,
  search: !0,
  tel: !0,
  text: !0,
  time: !0,
  url: !0,
  week: !0,
};
function tu(e) {
  var t = e && e.nodeName && e.nodeName.toLowerCase();
  return t === 'input' ? !!_f[e.type] : t === 'textarea';
}
function Ds(e, t, n, r) {
  (ps(r),
    (t = Ur(t, 'onChange')),
    0 < t.length &&
      ((n = new eo('onChange', 'change', null, n, r)),
      e.push({ event: n, listeners: t })));
}
var _n = null,
  Un = null;
function jf(e) {
  Ys(e, 0);
}
function rl(e) {
  var t = At(e);
  if (os(t)) return e;
}
function Pf(e, t) {
  if (e === 'change') return t;
}
var Fs = !1;
if (Ke) {
  var zl;
  if (Ke) {
    var Ll = 'oninput' in document;
    if (!Ll) {
      var nu = document.createElement('div');
      (nu.setAttribute('oninput', 'return;'),
        (Ll = typeof nu.oninput == 'function'));
    }
    zl = Ll;
  } else zl = !1;
  Fs = zl && (!document.documentMode || 9 < document.documentMode);
}
function ru() {
  _n && (_n.detachEvent('onpropertychange', Us), (Un = _n = null));
}
function Us(e) {
  if (e.propertyName === 'value' && rl(Un)) {
    var t = [];
    (Ds(t, Un, e, Xi(e)), ys(jf, t));
  }
}
function zf(e, t, n) {
  e === 'focusin'
    ? (ru(), (_n = t), (Un = n), _n.attachEvent('onpropertychange', Us))
    : e === 'focusout' && ru();
}
function Lf(e) {
  if (e === 'selectionchange' || e === 'keyup' || e === 'keydown')
    return rl(Un);
}
function Tf(e, t) {
  if (e === 'click') return rl(t);
}
function Rf(e, t) {
  if (e === 'input' || e === 'change') return rl(t);
}
function Mf(e, t) {
  return (e === t && (e !== 0 || 1 / e === 1 / t)) || (e !== e && t !== t);
}
var Ie = typeof Object.is == 'function' ? Object.is : Mf;
function An(e, t) {
  if (Ie(e, t)) return !0;
  if (typeof e != 'object' || e === null || typeof t != 'object' || t === null)
    return !1;
  var n = Object.keys(e),
    r = Object.keys(t);
  if (n.length !== r.length) return !1;
  for (r = 0; r < n.length; r++) {
    var l = n[r];
    if (!Kl.call(t, l) || !Ie(e[l], t[l])) return !1;
  }
  return !0;
}
function lu(e) {
  for (; e && e.firstChild; ) e = e.firstChild;
  return e;
}
function iu(e, t) {
  var n = lu(e);
  e = 0;
  for (var r; n; ) {
    if (n.nodeType === 3) {
      if (((r = e + n.textContent.length), e <= t && r >= t))
        return { node: n, offset: t - e };
      e = r;
    }
    e: {
      for (; n; ) {
        if (n.nextSibling) {
          n = n.nextSibling;
          break e;
        }
        n = n.parentNode;
      }
      n = void 0;
    }
    n = lu(n);
  }
}
function As(e, t) {
  return e && t
    ? e === t
      ? !0
      : e && e.nodeType === 3
        ? !1
        : t && t.nodeType === 3
          ? As(e, t.parentNode)
          : 'contains' in e
            ? e.contains(t)
            : e.compareDocumentPosition
              ? !!(e.compareDocumentPosition(t) & 16)
              : !1
    : !1;
}
function $s() {
  for (var e = window, t = Tr(); t instanceof e.HTMLIFrameElement; ) {
    try {
      var n = typeof t.contentWindow.location.href == 'string';
    } catch {
      n = !1;
    }
    if (n) e = t.contentWindow;
    else break;
    t = Tr(e.document);
  }
  return t;
}
function ro(e) {
  var t = e && e.nodeName && e.nodeName.toLowerCase();
  return (
    t &&
    ((t === 'input' &&
      (e.type === 'text' ||
        e.type === 'search' ||
        e.type === 'tel' ||
        e.type === 'url' ||
        e.type === 'password')) ||
      t === 'textarea' ||
      e.contentEditable === 'true')
  );
}
function If(e) {
  var t = $s(),
    n = e.focusedElem,
    r = e.selectionRange;
  if (
    t !== n &&
    n &&
    n.ownerDocument &&
    As(n.ownerDocument.documentElement, n)
  ) {
    if (r !== null && ro(n)) {
      if (
        ((t = r.start),
        (e = r.end),
        e === void 0 && (e = t),
        'selectionStart' in n)
      )
        ((n.selectionStart = t),
          (n.selectionEnd = Math.min(e, n.value.length)));
      else if (
        ((e = ((t = n.ownerDocument || document) && t.defaultView) || window),
        e.getSelection)
      ) {
        e = e.getSelection();
        var l = n.textContent.length,
          i = Math.min(r.start, l);
        ((r = r.end === void 0 ? i : Math.min(r.end, l)),
          !e.extend && i > r && ((l = r), (r = i), (i = l)),
          (l = iu(n, i)));
        var o = iu(n, r);
        l &&
          o &&
          (e.rangeCount !== 1 ||
            e.anchorNode !== l.node ||
            e.anchorOffset !== l.offset ||
            e.focusNode !== o.node ||
            e.focusOffset !== o.offset) &&
          ((t = t.createRange()),
          t.setStart(l.node, l.offset),
          e.removeAllRanges(),
          i > r
            ? (e.addRange(t), e.extend(o.node, o.offset))
            : (t.setEnd(o.node, o.offset), e.addRange(t)));
      }
    }
    for (t = [], e = n; (e = e.parentNode); )
      e.nodeType === 1 &&
        t.push({ element: e, left: e.scrollLeft, top: e.scrollTop });
    for (typeof n.focus == 'function' && n.focus(), n = 0; n < t.length; n++)
      ((e = t[n]),
        (e.element.scrollLeft = e.left),
        (e.element.scrollTop = e.top));
  }
}
var Of = Ke && 'documentMode' in document && 11 >= document.documentMode,
  Ft = null,
  fi = null,
  jn = null,
  di = !1;
function ou(e, t, n) {
  var r = n.window === n ? n.document : n.nodeType === 9 ? n : n.ownerDocument;
  di ||
    Ft == null ||
    Ft !== Tr(r) ||
    ((r = Ft),
    'selectionStart' in r && ro(r)
      ? (r = { start: r.selectionStart, end: r.selectionEnd })
      : ((r = (
          (r.ownerDocument && r.ownerDocument.defaultView) ||
          window
        ).getSelection()),
        (r = {
          anchorNode: r.anchorNode,
          anchorOffset: r.anchorOffset,
          focusNode: r.focusNode,
          focusOffset: r.focusOffset,
        })),
    (jn && An(jn, r)) ||
      ((jn = r),
      (r = Ur(fi, 'onSelect')),
      0 < r.length &&
        ((t = new eo('onSelect', 'select', null, t, n)),
        e.push({ event: t, listeners: r }),
        (t.target = Ft))));
}
function cr(e, t) {
  var n = {};
  return (
    (n[e.toLowerCase()] = t.toLowerCase()),
    (n['Webkit' + e] = 'webkit' + t),
    (n['Moz' + e] = 'moz' + t),
    n
  );
}
var Ut = {
    animationend: cr('Animation', 'AnimationEnd'),
    animationiteration: cr('Animation', 'AnimationIteration'),
    animationstart: cr('Animation', 'AnimationStart'),
    transitionend: cr('Transition', 'TransitionEnd'),
  },
  Tl = {},
  Bs = {};
Ke &&
  ((Bs = document.createElement('div').style),
  'AnimationEvent' in window ||
    (delete Ut.animationend.animation,
    delete Ut.animationiteration.animation,
    delete Ut.animationstart.animation),
  'TransitionEvent' in window || delete Ut.transitionend.transition);
function ll(e) {
  if (Tl[e]) return Tl[e];
  if (!Ut[e]) return e;
  var t = Ut[e],
    n;
  for (n in t) if (t.hasOwnProperty(n) && n in Bs) return (Tl[e] = t[n]);
  return e;
}
var Vs = ll('animationend'),
  Ws = ll('animationiteration'),
  Hs = ll('animationstart'),
  Qs = ll('transitionend'),
  Ks = new Map(),
  uu =
    'abort auxClick cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel'.split(
      ' ',
    );
function ht(e, t) {
  (Ks.set(e, t), Tt(t, [e]));
}
for (var Rl = 0; Rl < uu.length; Rl++) {
  var Ml = uu[Rl],
    Df = Ml.toLowerCase(),
    Ff = Ml[0].toUpperCase() + Ml.slice(1);
  ht(Df, 'on' + Ff);
}
ht(Vs, 'onAnimationEnd');
ht(Ws, 'onAnimationIteration');
ht(Hs, 'onAnimationStart');
ht('dblclick', 'onDoubleClick');
ht('focusin', 'onFocus');
ht('focusout', 'onBlur');
ht(Qs, 'onTransitionEnd');
qt('onMouseEnter', ['mouseout', 'mouseover']);
qt('onMouseLeave', ['mouseout', 'mouseover']);
qt('onPointerEnter', ['pointerout', 'pointerover']);
qt('onPointerLeave', ['pointerout', 'pointerover']);
Tt(
  'onChange',
  'change click focusin focusout input keydown keyup selectionchange'.split(
    ' ',
  ),
);
Tt(
  'onSelect',
  'focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange'.split(
    ' ',
  ),
);
Tt('onBeforeInput', ['compositionend', 'keypress', 'textInput', 'paste']);
Tt(
  'onCompositionEnd',
  'compositionend focusout keydown keypress keyup mousedown'.split(' '),
);
Tt(
  'onCompositionStart',
  'compositionstart focusout keydown keypress keyup mousedown'.split(' '),
);
Tt(
  'onCompositionUpdate',
  'compositionupdate focusout keydown keypress keyup mousedown'.split(' '),
);
var xn =
    'abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting'.split(
      ' ',
    ),
  Uf = new Set('cancel close invalid load scroll toggle'.split(' ').concat(xn));
function su(e, t, n) {
  var r = e.type || 'unknown-event';
  ((e.currentTarget = n), Oc(r, t, void 0, e), (e.currentTarget = null));
}
function Ys(e, t) {
  t = (t & 4) !== 0;
  for (var n = 0; n < e.length; n++) {
    var r = e[n],
      l = r.event;
    r = r.listeners;
    e: {
      var i = void 0;
      if (t)
        for (var o = r.length - 1; 0 <= o; o--) {
          var u = r[o],
            s = u.instance,
            c = u.currentTarget;
          if (((u = u.listener), s !== i && l.isPropagationStopped())) break e;
          (su(l, u, c), (i = s));
        }
      else
        for (o = 0; o < r.length; o++) {
          if (
            ((u = r[o]),
            (s = u.instance),
            (c = u.currentTarget),
            (u = u.listener),
            s !== i && l.isPropagationStopped())
          )
            break e;
          (su(l, u, c), (i = s));
        }
    }
  }
  if (Mr) throw ((e = ui), (Mr = !1), (ui = null), e);
}
function D(e, t) {
  var n = t[yi];
  n === void 0 && (n = t[yi] = new Set());
  var r = e + '__bubble';
  n.has(r) || (Xs(t, e, 2, !1), n.add(r));
}
function Il(e, t, n) {
  var r = 0;
  (t && (r |= 4), Xs(n, e, r, t));
}
var fr = '_reactListening' + Math.random().toString(36).slice(2);
function $n(e) {
  if (!e[fr]) {
    ((e[fr] = !0),
      ts.forEach(function (n) {
        n !== 'selectionchange' && (Uf.has(n) || Il(n, !1, e), Il(n, !0, e));
      }));
    var t = e.nodeType === 9 ? e : e.ownerDocument;
    t === null || t[fr] || ((t[fr] = !0), Il('selectionchange', !1, t));
  }
}
function Xs(e, t, n, r) {
  switch (Ts(t)) {
    case 1:
      var l = Jc;
      break;
    case 4:
      l = qc;
      break;
    default:
      l = qi;
  }
  ((n = l.bind(null, t, n, e)),
    (l = void 0),
    !oi ||
      (t !== 'touchstart' && t !== 'touchmove' && t !== 'wheel') ||
      (l = !0),
    r
      ? l !== void 0
        ? e.addEventListener(t, n, { capture: !0, passive: l })
        : e.addEventListener(t, n, !0)
      : l !== void 0
        ? e.addEventListener(t, n, { passive: l })
        : e.addEventListener(t, n, !1));
}
function Ol(e, t, n, r, l) {
  var i = r;
  if (!(t & 1) && !(t & 2) && r !== null)
    e: for (;;) {
      if (r === null) return;
      var o = r.tag;
      if (o === 3 || o === 4) {
        var u = r.stateNode.containerInfo;
        if (u === l || (u.nodeType === 8 && u.parentNode === l)) break;
        if (o === 4)
          for (o = r.return; o !== null; ) {
            var s = o.tag;
            if (
              (s === 3 || s === 4) &&
              ((s = o.stateNode.containerInfo),
              s === l || (s.nodeType === 8 && s.parentNode === l))
            )
              return;
            o = o.return;
          }
        for (; u !== null; ) {
          if (((o = St(u)), o === null)) return;
          if (((s = o.tag), s === 5 || s === 6)) {
            r = i = o;
            continue e;
          }
          u = u.parentNode;
        }
      }
      r = r.return;
    }
  ys(function () {
    var c = i,
      v = Xi(n),
      m = [];
    e: {
      var h = Ks.get(e);
      if (h !== void 0) {
        var S = eo,
          w = e;
        switch (e) {
          case 'keypress':
            if (Er(n) === 0) break e;
          case 'keydown':
          case 'keyup':
            S = hf;
            break;
          case 'focusin':
            ((w = 'focus'), (S = Pl));
            break;
          case 'focusout':
            ((w = 'blur'), (S = Pl));
            break;
          case 'beforeblur':
          case 'afterblur':
            S = Pl;
            break;
          case 'click':
            if (n.button === 2) break e;
          case 'auxclick':
          case 'dblclick':
          case 'mousedown':
          case 'mousemove':
          case 'mouseup':
          case 'mouseout':
          case 'mouseover':
          case 'contextmenu':
            S = Zo;
            break;
          case 'drag':
          case 'dragend':
          case 'dragenter':
          case 'dragexit':
          case 'dragleave':
          case 'dragover':
          case 'dragstart':
          case 'drop':
            S = tf;
            break;
          case 'touchcancel':
          case 'touchend':
          case 'touchmove':
          case 'touchstart':
            S = yf;
            break;
          case Vs:
          case Ws:
          case Hs:
            S = lf;
            break;
          case Qs:
            S = wf;
            break;
          case 'scroll':
            S = bc;
            break;
          case 'wheel':
            S = Sf;
            break;
          case 'copy':
          case 'cut':
          case 'paste':
            S = uf;
            break;
          case 'gotpointercapture':
          case 'lostpointercapture':
          case 'pointercancel':
          case 'pointerdown':
          case 'pointermove':
          case 'pointerout':
          case 'pointerover':
          case 'pointerup':
            S = qo;
        }
        var x = (t & 4) !== 0,
          M = !x && e === 'scroll',
          f = x ? (h !== null ? h + 'Capture' : null) : h;
        x = [];
        for (var a = c, d; a !== null; ) {
          d = a;
          var y = d.stateNode;
          if (
            (d.tag === 5 &&
              y !== null &&
              ((d = y),
              f !== null && ((y = In(a, f)), y != null && x.push(Bn(a, y, d)))),
            M)
          )
            break;
          a = a.return;
        }
        0 < x.length &&
          ((h = new S(h, w, null, n, v)), m.push({ event: h, listeners: x }));
      }
    }
    if (!(t & 7)) {
      e: {
        if (
          ((h = e === 'mouseover' || e === 'pointerover'),
          (S = e === 'mouseout' || e === 'pointerout'),
          h &&
            n !== li &&
            (w = n.relatedTarget || n.fromElement) &&
            (St(w) || w[Ye]))
        )
          break e;
        if (
          (S || h) &&
          ((h =
            v.window === v
              ? v
              : (h = v.ownerDocument)
                ? h.defaultView || h.parentWindow
                : window),
          S
            ? ((w = n.relatedTarget || n.toElement),
              (S = c),
              (w = w ? St(w) : null),
              w !== null &&
                ((M = Rt(w)), w !== M || (w.tag !== 5 && w.tag !== 6)) &&
                (w = null))
            : ((S = null), (w = c)),
          S !== w)
        ) {
          if (
            ((x = Zo),
            (y = 'onMouseLeave'),
            (f = 'onMouseEnter'),
            (a = 'mouse'),
            (e === 'pointerout' || e === 'pointerover') &&
              ((x = qo),
              (y = 'onPointerLeave'),
              (f = 'onPointerEnter'),
              (a = 'pointer')),
            (M = S == null ? h : At(S)),
            (d = w == null ? h : At(w)),
            (h = new x(y, a + 'leave', S, n, v)),
            (h.target = M),
            (h.relatedTarget = d),
            (y = null),
            St(v) === c &&
              ((x = new x(f, a + 'enter', w, n, v)),
              (x.target = d),
              (x.relatedTarget = M),
              (y = x)),
            (M = y),
            S && w)
          )
            t: {
              for (x = S, f = w, a = 0, d = x; d; d = Mt(d)) a++;
              for (d = 0, y = f; y; y = Mt(y)) d++;
              for (; 0 < a - d; ) ((x = Mt(x)), a--);
              for (; 0 < d - a; ) ((f = Mt(f)), d--);
              for (; a--; ) {
                if (x === f || (f !== null && x === f.alternate)) break t;
                ((x = Mt(x)), (f = Mt(f)));
              }
              x = null;
            }
          else x = null;
          (S !== null && au(m, h, S, x, !1),
            w !== null && M !== null && au(m, M, w, x, !0));
        }
      }
      e: {
        if (
          ((h = c ? At(c) : window),
          (S = h.nodeName && h.nodeName.toLowerCase()),
          S === 'select' || (S === 'input' && h.type === 'file'))
        )
          var k = Pf;
        else if (tu(h))
          if (Fs) k = Rf;
          else {
            k = Lf;
            var E = zf;
          }
        else
          (S = h.nodeName) &&
            S.toLowerCase() === 'input' &&
            (h.type === 'checkbox' || h.type === 'radio') &&
            (k = Tf);
        if (k && (k = k(e, c))) {
          Ds(m, k, n, v);
          break e;
        }
        (E && E(e, h, c),
          e === 'focusout' &&
            (E = h._wrapperState) &&
            E.controlled &&
            h.type === 'number' &&
            bl(h, 'number', h.value));
      }
      switch (((E = c ? At(c) : window), e)) {
        case 'focusin':
          (tu(E) || E.contentEditable === 'true') &&
            ((Ft = E), (fi = c), (jn = null));
          break;
        case 'focusout':
          jn = fi = Ft = null;
          break;
        case 'mousedown':
          di = !0;
          break;
        case 'contextmenu':
        case 'mouseup':
        case 'dragend':
          ((di = !1), ou(m, n, v));
          break;
        case 'selectionchange':
          if (Of) break;
        case 'keydown':
        case 'keyup':
          ou(m, n, v);
      }
      var _;
      if (no)
        e: {
          switch (e) {
            case 'compositionstart':
              var j = 'onCompositionStart';
              break e;
            case 'compositionend':
              j = 'onCompositionEnd';
              break e;
            case 'compositionupdate':
              j = 'onCompositionUpdate';
              break e;
          }
          j = void 0;
        }
      else
        Dt
          ? Is(e, n) && (j = 'onCompositionEnd')
          : e === 'keydown' && n.keyCode === 229 && (j = 'onCompositionStart');
      (j &&
        (Ms &&
          n.locale !== 'ko' &&
          (Dt || j !== 'onCompositionStart'
            ? j === 'onCompositionEnd' && Dt && (_ = Rs())
            : ((nt = v),
              (bi = 'value' in nt ? nt.value : nt.textContent),
              (Dt = !0))),
        (E = Ur(c, j)),
        0 < E.length &&
          ((j = new Jo(j, e, null, n, v)),
          m.push({ event: j, listeners: E }),
          _ ? (j.data = _) : ((_ = Os(n)), _ !== null && (j.data = _)))),
        (_ = Ef ? Nf(e, n) : Cf(e, n)) &&
          ((c = Ur(c, 'onBeforeInput')),
          0 < c.length &&
            ((v = new Jo('onBeforeInput', 'beforeinput', null, n, v)),
            m.push({ event: v, listeners: c }),
            (v.data = _))));
    }
    Ys(m, t);
  });
}
function Bn(e, t, n) {
  return { instance: e, listener: t, currentTarget: n };
}
function Ur(e, t) {
  for (var n = t + 'Capture', r = []; e !== null; ) {
    var l = e,
      i = l.stateNode;
    (l.tag === 5 &&
      i !== null &&
      ((l = i),
      (i = In(e, n)),
      i != null && r.unshift(Bn(e, i, l)),
      (i = In(e, t)),
      i != null && r.push(Bn(e, i, l))),
      (e = e.return));
  }
  return r;
}
function Mt(e) {
  if (e === null) return null;
  do e = e.return;
  while (e && e.tag !== 5);
  return e || null;
}
function au(e, t, n, r, l) {
  for (var i = t._reactName, o = []; n !== null && n !== r; ) {
    var u = n,
      s = u.alternate,
      c = u.stateNode;
    if (s !== null && s === r) break;
    (u.tag === 5 &&
      c !== null &&
      ((u = c),
      l
        ? ((s = In(n, i)), s != null && o.unshift(Bn(n, s, u)))
        : l || ((s = In(n, i)), s != null && o.push(Bn(n, s, u)))),
      (n = n.return));
  }
  o.length !== 0 && e.push({ event: t, listeners: o });
}
var Af = /\r\n?/g,
  $f = /\u0000|\uFFFD/g;
function cu(e) {
  return (typeof e == 'string' ? e : '' + e)
    .replace(
      Af,
      `
`,
    )
    .replace($f, '');
}
function dr(e, t, n) {
  if (((t = cu(t)), cu(e) !== t && n)) throw Error(g(425));
}
function Ar() {}
var pi = null,
  hi = null;
function mi(e, t) {
  return (
    e === 'textarea' ||
    e === 'noscript' ||
    typeof t.children == 'string' ||
    typeof t.children == 'number' ||
    (typeof t.dangerouslySetInnerHTML == 'object' &&
      t.dangerouslySetInnerHTML !== null &&
      t.dangerouslySetInnerHTML.__html != null)
  );
}
var vi = typeof setTimeout == 'function' ? setTimeout : void 0,
  Bf = typeof clearTimeout == 'function' ? clearTimeout : void 0,
  fu = typeof Promise == 'function' ? Promise : void 0,
  Vf =
    typeof queueMicrotask == 'function'
      ? queueMicrotask
      : typeof fu < 'u'
        ? function (e) {
            return fu.resolve(null).then(e).catch(Wf);
          }
        : vi;
function Wf(e) {
  setTimeout(function () {
    throw e;
  });
}
function Dl(e, t) {
  var n = t,
    r = 0;
  do {
    var l = n.nextSibling;
    if ((e.removeChild(n), l && l.nodeType === 8))
      if (((n = l.data), n === '/$')) {
        if (r === 0) {
          (e.removeChild(l), Fn(t));
          return;
        }
        r--;
      } else (n !== '$' && n !== '$?' && n !== '$!') || r++;
    n = l;
  } while (n);
  Fn(t);
}
function ut(e) {
  for (; e != null; e = e.nextSibling) {
    var t = e.nodeType;
    if (t === 1 || t === 3) break;
    if (t === 8) {
      if (((t = e.data), t === '$' || t === '$!' || t === '$?')) break;
      if (t === '/$') return null;
    }
  }
  return e;
}
function du(e) {
  e = e.previousSibling;
  for (var t = 0; e; ) {
    if (e.nodeType === 8) {
      var n = e.data;
      if (n === '$' || n === '$!' || n === '$?') {
        if (t === 0) return e;
        t--;
      } else n === '/$' && t++;
    }
    e = e.previousSibling;
  }
  return null;
}
var sn = Math.random().toString(36).slice(2),
  Ue = '__reactFiber$' + sn,
  Vn = '__reactProps$' + sn,
  Ye = '__reactContainer$' + sn,
  yi = '__reactEvents$' + sn,
  Hf = '__reactListeners$' + sn,
  Qf = '__reactHandles$' + sn;
function St(e) {
  var t = e[Ue];
  if (t) return t;
  for (var n = e.parentNode; n; ) {
    if ((t = n[Ye] || n[Ue])) {
      if (
        ((n = t.alternate),
        t.child !== null || (n !== null && n.child !== null))
      )
        for (e = du(e); e !== null; ) {
          if ((n = e[Ue])) return n;
          e = du(e);
        }
      return t;
    }
    ((e = n), (n = e.parentNode));
  }
  return null;
}
function qn(e) {
  return (
    (e = e[Ue] || e[Ye]),
    !e || (e.tag !== 5 && e.tag !== 6 && e.tag !== 13 && e.tag !== 3) ? null : e
  );
}
function At(e) {
  if (e.tag === 5 || e.tag === 6) return e.stateNode;
  throw Error(g(33));
}
function il(e) {
  return e[Vn] || null;
}
var gi = [],
  $t = -1;
function mt(e) {
  return { current: e };
}
function F(e) {
  0 > $t || ((e.current = gi[$t]), (gi[$t] = null), $t--);
}
function O(e, t) {
  ($t++, (gi[$t] = e.current), (e.current = t));
}
var pt = {},
  ie = mt(pt),
  de = mt(!1),
  _t = pt;
function bt(e, t) {
  var n = e.type.contextTypes;
  if (!n) return pt;
  var r = e.stateNode;
  if (r && r.__reactInternalMemoizedUnmaskedChildContext === t)
    return r.__reactInternalMemoizedMaskedChildContext;
  var l = {},
    i;
  for (i in n) l[i] = t[i];
  return (
    r &&
      ((e = e.stateNode),
      (e.__reactInternalMemoizedUnmaskedChildContext = t),
      (e.__reactInternalMemoizedMaskedChildContext = l)),
    l
  );
}
function pe(e) {
  return ((e = e.childContextTypes), e != null);
}
function $r() {
  (F(de), F(ie));
}
function pu(e, t, n) {
  if (ie.current !== pt) throw Error(g(168));
  (O(ie, t), O(de, n));
}
function Gs(e, t, n) {
  var r = e.stateNode;
  if (((t = t.childContextTypes), typeof r.getChildContext != 'function'))
    return n;
  r = r.getChildContext();
  for (var l in r) if (!(l in t)) throw Error(g(108, Pc(e) || 'Unknown', l));
  return V({}, n, r);
}
function Br(e) {
  return (
    (e =
      ((e = e.stateNode) && e.__reactInternalMemoizedMergedChildContext) || pt),
    (_t = ie.current),
    O(ie, e),
    O(de, de.current),
    !0
  );
}
function hu(e, t, n) {
  var r = e.stateNode;
  if (!r) throw Error(g(169));
  (n
    ? ((e = Gs(e, t, _t)),
      (r.__reactInternalMemoizedMergedChildContext = e),
      F(de),
      F(ie),
      O(ie, e))
    : F(de),
    O(de, n));
}
var Ve = null,
  ol = !1,
  Fl = !1;
function Zs(e) {
  Ve === null ? (Ve = [e]) : Ve.push(e);
}
function Kf(e) {
  ((ol = !0), Zs(e));
}
function vt() {
  if (!Fl && Ve !== null) {
    Fl = !0;
    var e = 0,
      t = I;
    try {
      var n = Ve;
      for (I = 1; e < n.length; e++) {
        var r = n[e];
        do r = r(!0);
        while (r !== null);
      }
      ((Ve = null), (ol = !1));
    } catch (l) {
      throw (Ve !== null && (Ve = Ve.slice(e + 1)), Ss(Gi, vt), l);
    } finally {
      ((I = t), (Fl = !1));
    }
  }
  return null;
}
var Bt = [],
  Vt = 0,
  Vr = null,
  Wr = 0,
  Se = [],
  xe = 0,
  jt = null,
  We = 1,
  He = '';
function wt(e, t) {
  ((Bt[Vt++] = Wr), (Bt[Vt++] = Vr), (Vr = e), (Wr = t));
}
function Js(e, t, n) {
  ((Se[xe++] = We), (Se[xe++] = He), (Se[xe++] = jt), (jt = e));
  var r = We;
  e = He;
  var l = 32 - Re(r) - 1;
  ((r &= ~(1 << l)), (n += 1));
  var i = 32 - Re(t) + l;
  if (30 < i) {
    var o = l - (l % 5);
    ((i = (r & ((1 << o) - 1)).toString(32)),
      (r >>= o),
      (l -= o),
      (We = (1 << (32 - Re(t) + l)) | (n << l) | r),
      (He = i + e));
  } else ((We = (1 << i) | (n << l) | r), (He = e));
}
function lo(e) {
  e.return !== null && (wt(e, 1), Js(e, 1, 0));
}
function io(e) {
  for (; e === Vr; )
    ((Vr = Bt[--Vt]), (Bt[Vt] = null), (Wr = Bt[--Vt]), (Bt[Vt] = null));
  for (; e === jt; )
    ((jt = Se[--xe]),
      (Se[xe] = null),
      (He = Se[--xe]),
      (Se[xe] = null),
      (We = Se[--xe]),
      (Se[xe] = null));
}
var ye = null,
  ve = null,
  A = !1,
  Te = null;
function qs(e, t) {
  var n = Ee(5, null, null, 0);
  ((n.elementType = 'DELETED'),
    (n.stateNode = t),
    (n.return = e),
    (t = e.deletions),
    t === null ? ((e.deletions = [n]), (e.flags |= 16)) : t.push(n));
}
function mu(e, t) {
  switch (e.tag) {
    case 5:
      var n = e.type;
      return (
        (t =
          t.nodeType !== 1 || n.toLowerCase() !== t.nodeName.toLowerCase()
            ? null
            : t),
        t !== null
          ? ((e.stateNode = t), (ye = e), (ve = ut(t.firstChild)), !0)
          : !1
      );
    case 6:
      return (
        (t = e.pendingProps === '' || t.nodeType !== 3 ? null : t),
        t !== null ? ((e.stateNode = t), (ye = e), (ve = null), !0) : !1
      );
    case 13:
      return (
        (t = t.nodeType !== 8 ? null : t),
        t !== null
          ? ((n = jt !== null ? { id: We, overflow: He } : null),
            (e.memoizedState = {
              dehydrated: t,
              treeContext: n,
              retryLane: 1073741824,
            }),
            (n = Ee(18, null, null, 0)),
            (n.stateNode = t),
            (n.return = e),
            (e.child = n),
            (ye = e),
            (ve = null),
            !0)
          : !1
      );
    default:
      return !1;
  }
}
function wi(e) {
  return (e.mode & 1) !== 0 && (e.flags & 128) === 0;
}
function ki(e) {
  if (A) {
    var t = ve;
    if (t) {
      var n = t;
      if (!mu(e, t)) {
        if (wi(e)) throw Error(g(418));
        t = ut(n.nextSibling);
        var r = ye;
        t && mu(e, t)
          ? qs(r, n)
          : ((e.flags = (e.flags & -4097) | 2), (A = !1), (ye = e));
      }
    } else {
      if (wi(e)) throw Error(g(418));
      ((e.flags = (e.flags & -4097) | 2), (A = !1), (ye = e));
    }
  }
}
function vu(e) {
  for (e = e.return; e !== null && e.tag !== 5 && e.tag !== 3 && e.tag !== 13; )
    e = e.return;
  ye = e;
}
function pr(e) {
  if (e !== ye) return !1;
  if (!A) return (vu(e), (A = !0), !1);
  var t;
  if (
    ((t = e.tag !== 3) &&
      !(t = e.tag !== 5) &&
      ((t = e.type),
      (t = t !== 'head' && t !== 'body' && !mi(e.type, e.memoizedProps))),
    t && (t = ve))
  ) {
    if (wi(e)) throw (bs(), Error(g(418)));
    for (; t; ) (qs(e, t), (t = ut(t.nextSibling)));
  }
  if ((vu(e), e.tag === 13)) {
    if (((e = e.memoizedState), (e = e !== null ? e.dehydrated : null), !e))
      throw Error(g(317));
    e: {
      for (e = e.nextSibling, t = 0; e; ) {
        if (e.nodeType === 8) {
          var n = e.data;
          if (n === '/$') {
            if (t === 0) {
              ve = ut(e.nextSibling);
              break e;
            }
            t--;
          } else (n !== '$' && n !== '$!' && n !== '$?') || t++;
        }
        e = e.nextSibling;
      }
      ve = null;
    }
  } else ve = ye ? ut(e.stateNode.nextSibling) : null;
  return !0;
}
function bs() {
  for (var e = ve; e; ) e = ut(e.nextSibling);
}
function en() {
  ((ve = ye = null), (A = !1));
}
function oo(e) {
  Te === null ? (Te = [e]) : Te.push(e);
}
var Yf = Ze.ReactCurrentBatchConfig;
function vn(e, t, n) {
  if (
    ((e = n.ref), e !== null && typeof e != 'function' && typeof e != 'object')
  ) {
    if (n._owner) {
      if (((n = n._owner), n)) {
        if (n.tag !== 1) throw Error(g(309));
        var r = n.stateNode;
      }
      if (!r) throw Error(g(147, e));
      var l = r,
        i = '' + e;
      return t !== null &&
        t.ref !== null &&
        typeof t.ref == 'function' &&
        t.ref._stringRef === i
        ? t.ref
        : ((t = function (o) {
            var u = l.refs;
            o === null ? delete u[i] : (u[i] = o);
          }),
          (t._stringRef = i),
          t);
    }
    if (typeof e != 'string') throw Error(g(284));
    if (!n._owner) throw Error(g(290, e));
  }
  return e;
}
function hr(e, t) {
  throw (
    (e = Object.prototype.toString.call(t)),
    Error(
      g(
        31,
        e === '[object Object]'
          ? 'object with keys {' + Object.keys(t).join(', ') + '}'
          : e,
      ),
    )
  );
}
function yu(e) {
  var t = e._init;
  return t(e._payload);
}
function ea(e) {
  function t(f, a) {
    if (e) {
      var d = f.deletions;
      d === null ? ((f.deletions = [a]), (f.flags |= 16)) : d.push(a);
    }
  }
  function n(f, a) {
    if (!e) return null;
    for (; a !== null; ) (t(f, a), (a = a.sibling));
    return null;
  }
  function r(f, a) {
    for (f = new Map(); a !== null; )
      (a.key !== null ? f.set(a.key, a) : f.set(a.index, a), (a = a.sibling));
    return f;
  }
  function l(f, a) {
    return ((f = ft(f, a)), (f.index = 0), (f.sibling = null), f);
  }
  function i(f, a, d) {
    return (
      (f.index = d),
      e
        ? ((d = f.alternate),
          d !== null
            ? ((d = d.index), d < a ? ((f.flags |= 2), a) : d)
            : ((f.flags |= 2), a))
        : ((f.flags |= 1048576), a)
    );
  }
  function o(f) {
    return (e && f.alternate === null && (f.flags |= 2), f);
  }
  function u(f, a, d, y) {
    return a === null || a.tag !== 6
      ? ((a = Hl(d, f.mode, y)), (a.return = f), a)
      : ((a = l(a, d)), (a.return = f), a);
  }
  function s(f, a, d, y) {
    var k = d.type;
    return k === Ot
      ? v(f, a, d.props.children, y, d.key)
      : a !== null &&
          (a.elementType === k ||
            (typeof k == 'object' &&
              k !== null &&
              k.$$typeof === qe &&
              yu(k) === a.type))
        ? ((y = l(a, d.props)), (y.ref = vn(f, a, d)), (y.return = f), y)
        : ((y = Lr(d.type, d.key, d.props, null, f.mode, y)),
          (y.ref = vn(f, a, d)),
          (y.return = f),
          y);
  }
  function c(f, a, d, y) {
    return a === null ||
      a.tag !== 4 ||
      a.stateNode.containerInfo !== d.containerInfo ||
      a.stateNode.implementation !== d.implementation
      ? ((a = Ql(d, f.mode, y)), (a.return = f), a)
      : ((a = l(a, d.children || [])), (a.return = f), a);
  }
  function v(f, a, d, y, k) {
    return a === null || a.tag !== 7
      ? ((a = Ct(d, f.mode, y, k)), (a.return = f), a)
      : ((a = l(a, d)), (a.return = f), a);
  }
  function m(f, a, d) {
    if ((typeof a == 'string' && a !== '') || typeof a == 'number')
      return ((a = Hl('' + a, f.mode, d)), (a.return = f), a);
    if (typeof a == 'object' && a !== null) {
      switch (a.$$typeof) {
        case rr:
          return (
            (d = Lr(a.type, a.key, a.props, null, f.mode, d)),
            (d.ref = vn(f, null, a)),
            (d.return = f),
            d
          );
        case It:
          return ((a = Ql(a, f.mode, d)), (a.return = f), a);
        case qe:
          var y = a._init;
          return m(f, y(a._payload), d);
      }
      if (kn(a) || fn(a))
        return ((a = Ct(a, f.mode, d, null)), (a.return = f), a);
      hr(f, a);
    }
    return null;
  }
  function h(f, a, d, y) {
    var k = a !== null ? a.key : null;
    if ((typeof d == 'string' && d !== '') || typeof d == 'number')
      return k !== null ? null : u(f, a, '' + d, y);
    if (typeof d == 'object' && d !== null) {
      switch (d.$$typeof) {
        case rr:
          return d.key === k ? s(f, a, d, y) : null;
        case It:
          return d.key === k ? c(f, a, d, y) : null;
        case qe:
          return ((k = d._init), h(f, a, k(d._payload), y));
      }
      if (kn(d) || fn(d)) return k !== null ? null : v(f, a, d, y, null);
      hr(f, d);
    }
    return null;
  }
  function S(f, a, d, y, k) {
    if ((typeof y == 'string' && y !== '') || typeof y == 'number')
      return ((f = f.get(d) || null), u(a, f, '' + y, k));
    if (typeof y == 'object' && y !== null) {
      switch (y.$$typeof) {
        case rr:
          return (
            (f = f.get(y.key === null ? d : y.key) || null),
            s(a, f, y, k)
          );
        case It:
          return (
            (f = f.get(y.key === null ? d : y.key) || null),
            c(a, f, y, k)
          );
        case qe:
          var E = y._init;
          return S(f, a, d, E(y._payload), k);
      }
      if (kn(y) || fn(y)) return ((f = f.get(d) || null), v(a, f, y, k, null));
      hr(a, y);
    }
    return null;
  }
  function w(f, a, d, y) {
    for (
      var k = null, E = null, _ = a, j = (a = 0), U = null;
      _ !== null && j < d.length;
      j++
    ) {
      _.index > j ? ((U = _), (_ = null)) : (U = _.sibling);
      var z = h(f, _, d[j], y);
      if (z === null) {
        _ === null && (_ = U);
        break;
      }
      (e && _ && z.alternate === null && t(f, _),
        (a = i(z, a, j)),
        E === null ? (k = z) : (E.sibling = z),
        (E = z),
        (_ = U));
    }
    if (j === d.length) return (n(f, _), A && wt(f, j), k);
    if (_ === null) {
      for (; j < d.length; j++)
        ((_ = m(f, d[j], y)),
          _ !== null &&
            ((a = i(_, a, j)),
            E === null ? (k = _) : (E.sibling = _),
            (E = _)));
      return (A && wt(f, j), k);
    }
    for (_ = r(f, _); j < d.length; j++)
      ((U = S(_, f, j, d[j], y)),
        U !== null &&
          (e && U.alternate !== null && _.delete(U.key === null ? j : U.key),
          (a = i(U, a, j)),
          E === null ? (k = U) : (E.sibling = U),
          (E = U)));
    return (
      e &&
        _.forEach(function (je) {
          return t(f, je);
        }),
      A && wt(f, j),
      k
    );
  }
  function x(f, a, d, y) {
    var k = fn(d);
    if (typeof k != 'function') throw Error(g(150));
    if (((d = k.call(d)), d == null)) throw Error(g(151));
    for (
      var E = (k = null), _ = a, j = (a = 0), U = null, z = d.next();
      _ !== null && !z.done;
      j++, z = d.next()
    ) {
      _.index > j ? ((U = _), (_ = null)) : (U = _.sibling);
      var je = h(f, _, z.value, y);
      if (je === null) {
        _ === null && (_ = U);
        break;
      }
      (e && _ && je.alternate === null && t(f, _),
        (a = i(je, a, j)),
        E === null ? (k = je) : (E.sibling = je),
        (E = je),
        (_ = U));
    }
    if (z.done) return (n(f, _), A && wt(f, j), k);
    if (_ === null) {
      for (; !z.done; j++, z = d.next())
        ((z = m(f, z.value, y)),
          z !== null &&
            ((a = i(z, a, j)),
            E === null ? (k = z) : (E.sibling = z),
            (E = z)));
      return (A && wt(f, j), k);
    }
    for (_ = r(f, _); !z.done; j++, z = d.next())
      ((z = S(_, f, j, z.value, y)),
        z !== null &&
          (e && z.alternate !== null && _.delete(z.key === null ? j : z.key),
          (a = i(z, a, j)),
          E === null ? (k = z) : (E.sibling = z),
          (E = z)));
    return (
      e &&
        _.forEach(function (an) {
          return t(f, an);
        }),
      A && wt(f, j),
      k
    );
  }
  function M(f, a, d, y) {
    if (
      (typeof d == 'object' &&
        d !== null &&
        d.type === Ot &&
        d.key === null &&
        (d = d.props.children),
      typeof d == 'object' && d !== null)
    ) {
      switch (d.$$typeof) {
        case rr:
          e: {
            for (var k = d.key, E = a; E !== null; ) {
              if (E.key === k) {
                if (((k = d.type), k === Ot)) {
                  if (E.tag === 7) {
                    (n(f, E.sibling),
                      (a = l(E, d.props.children)),
                      (a.return = f),
                      (f = a));
                    break e;
                  }
                } else if (
                  E.elementType === k ||
                  (typeof k == 'object' &&
                    k !== null &&
                    k.$$typeof === qe &&
                    yu(k) === E.type)
                ) {
                  (n(f, E.sibling),
                    (a = l(E, d.props)),
                    (a.ref = vn(f, E, d)),
                    (a.return = f),
                    (f = a));
                  break e;
                }
                n(f, E);
                break;
              } else t(f, E);
              E = E.sibling;
            }
            d.type === Ot
              ? ((a = Ct(d.props.children, f.mode, y, d.key)),
                (a.return = f),
                (f = a))
              : ((y = Lr(d.type, d.key, d.props, null, f.mode, y)),
                (y.ref = vn(f, a, d)),
                (y.return = f),
                (f = y));
          }
          return o(f);
        case It:
          e: {
            for (E = d.key; a !== null; ) {
              if (a.key === E)
                if (
                  a.tag === 4 &&
                  a.stateNode.containerInfo === d.containerInfo &&
                  a.stateNode.implementation === d.implementation
                ) {
                  (n(f, a.sibling),
                    (a = l(a, d.children || [])),
                    (a.return = f),
                    (f = a));
                  break e;
                } else {
                  n(f, a);
                  break;
                }
              else t(f, a);
              a = a.sibling;
            }
            ((a = Ql(d, f.mode, y)), (a.return = f), (f = a));
          }
          return o(f);
        case qe:
          return ((E = d._init), M(f, a, E(d._payload), y));
      }
      if (kn(d)) return w(f, a, d, y);
      if (fn(d)) return x(f, a, d, y);
      hr(f, d);
    }
    return (typeof d == 'string' && d !== '') || typeof d == 'number'
      ? ((d = '' + d),
        a !== null && a.tag === 6
          ? (n(f, a.sibling), (a = l(a, d)), (a.return = f), (f = a))
          : (n(f, a), (a = Hl(d, f.mode, y)), (a.return = f), (f = a)),
        o(f))
      : n(f, a);
  }
  return M;
}
var tn = ea(!0),
  ta = ea(!1),
  Hr = mt(null),
  Qr = null,
  Wt = null,
  uo = null;
function so() {
  uo = Wt = Qr = null;
}
function ao(e) {
  var t = Hr.current;
  (F(Hr), (e._currentValue = t));
}
function Si(e, t, n) {
  for (; e !== null; ) {
    var r = e.alternate;
    if (
      ((e.childLanes & t) !== t
        ? ((e.childLanes |= t), r !== null && (r.childLanes |= t))
        : r !== null && (r.childLanes & t) !== t && (r.childLanes |= t),
      e === n)
    )
      break;
    e = e.return;
  }
}
function Zt(e, t) {
  ((Qr = e),
    (uo = Wt = null),
    (e = e.dependencies),
    e !== null &&
      e.firstContext !== null &&
      (e.lanes & t && (fe = !0), (e.firstContext = null)));
}
function Ce(e) {
  var t = e._currentValue;
  if (uo !== e)
    if (((e = { context: e, memoizedValue: t, next: null }), Wt === null)) {
      if (Qr === null) throw Error(g(308));
      ((Wt = e), (Qr.dependencies = { lanes: 0, firstContext: e }));
    } else Wt = Wt.next = e;
  return t;
}
var xt = null;
function co(e) {
  xt === null ? (xt = [e]) : xt.push(e);
}
function na(e, t, n, r) {
  var l = t.interleaved;
  return (
    l === null ? ((n.next = n), co(t)) : ((n.next = l.next), (l.next = n)),
    (t.interleaved = n),
    Xe(e, r)
  );
}
function Xe(e, t) {
  e.lanes |= t;
  var n = e.alternate;
  for (n !== null && (n.lanes |= t), n = e, e = e.return; e !== null; )
    ((e.childLanes |= t),
      (n = e.alternate),
      n !== null && (n.childLanes |= t),
      (n = e),
      (e = e.return));
  return n.tag === 3 ? n.stateNode : null;
}
var be = !1;
function fo(e) {
  e.updateQueue = {
    baseState: e.memoizedState,
    firstBaseUpdate: null,
    lastBaseUpdate: null,
    shared: { pending: null, interleaved: null, lanes: 0 },
    effects: null,
  };
}
function ra(e, t) {
  ((e = e.updateQueue),
    t.updateQueue === e &&
      (t.updateQueue = {
        baseState: e.baseState,
        firstBaseUpdate: e.firstBaseUpdate,
        lastBaseUpdate: e.lastBaseUpdate,
        shared: e.shared,
        effects: e.effects,
      }));
}
function Qe(e, t) {
  return {
    eventTime: e,
    lane: t,
    tag: 0,
    payload: null,
    callback: null,
    next: null,
  };
}
function st(e, t, n) {
  var r = e.updateQueue;
  if (r === null) return null;
  if (((r = r.shared), R & 2)) {
    var l = r.pending;
    return (
      l === null ? (t.next = t) : ((t.next = l.next), (l.next = t)),
      (r.pending = t),
      Xe(e, n)
    );
  }
  return (
    (l = r.interleaved),
    l === null ? ((t.next = t), co(r)) : ((t.next = l.next), (l.next = t)),
    (r.interleaved = t),
    Xe(e, n)
  );
}
function Nr(e, t, n) {
  if (
    ((t = t.updateQueue), t !== null && ((t = t.shared), (n & 4194240) !== 0))
  ) {
    var r = t.lanes;
    ((r &= e.pendingLanes), (n |= r), (t.lanes = n), Zi(e, n));
  }
}
function gu(e, t) {
  var n = e.updateQueue,
    r = e.alternate;
  if (r !== null && ((r = r.updateQueue), n === r)) {
    var l = null,
      i = null;
    if (((n = n.firstBaseUpdate), n !== null)) {
      do {
        var o = {
          eventTime: n.eventTime,
          lane: n.lane,
          tag: n.tag,
          payload: n.payload,
          callback: n.callback,
          next: null,
        };
        (i === null ? (l = i = o) : (i = i.next = o), (n = n.next));
      } while (n !== null);
      i === null ? (l = i = t) : (i = i.next = t);
    } else l = i = t;
    ((n = {
      baseState: r.baseState,
      firstBaseUpdate: l,
      lastBaseUpdate: i,
      shared: r.shared,
      effects: r.effects,
    }),
      (e.updateQueue = n));
    return;
  }
  ((e = n.lastBaseUpdate),
    e === null ? (n.firstBaseUpdate = t) : (e.next = t),
    (n.lastBaseUpdate = t));
}
function Kr(e, t, n, r) {
  var l = e.updateQueue;
  be = !1;
  var i = l.firstBaseUpdate,
    o = l.lastBaseUpdate,
    u = l.shared.pending;
  if (u !== null) {
    l.shared.pending = null;
    var s = u,
      c = s.next;
    ((s.next = null), o === null ? (i = c) : (o.next = c), (o = s));
    var v = e.alternate;
    v !== null &&
      ((v = v.updateQueue),
      (u = v.lastBaseUpdate),
      u !== o &&
        (u === null ? (v.firstBaseUpdate = c) : (u.next = c),
        (v.lastBaseUpdate = s)));
  }
  if (i !== null) {
    var m = l.baseState;
    ((o = 0), (v = c = s = null), (u = i));
    do {
      var h = u.lane,
        S = u.eventTime;
      if ((r & h) === h) {
        v !== null &&
          (v = v.next =
            {
              eventTime: S,
              lane: 0,
              tag: u.tag,
              payload: u.payload,
              callback: u.callback,
              next: null,
            });
        e: {
          var w = e,
            x = u;
          switch (((h = t), (S = n), x.tag)) {
            case 1:
              if (((w = x.payload), typeof w == 'function')) {
                m = w.call(S, m, h);
                break e;
              }
              m = w;
              break e;
            case 3:
              w.flags = (w.flags & -65537) | 128;
            case 0:
              if (
                ((w = x.payload),
                (h = typeof w == 'function' ? w.call(S, m, h) : w),
                h == null)
              )
                break e;
              m = V({}, m, h);
              break e;
            case 2:
              be = !0;
          }
        }
        u.callback !== null &&
          u.lane !== 0 &&
          ((e.flags |= 64),
          (h = l.effects),
          h === null ? (l.effects = [u]) : h.push(u));
      } else
        ((S = {
          eventTime: S,
          lane: h,
          tag: u.tag,
          payload: u.payload,
          callback: u.callback,
          next: null,
        }),
          v === null ? ((c = v = S), (s = m)) : (v = v.next = S),
          (o |= h));
      if (((u = u.next), u === null)) {
        if (((u = l.shared.pending), u === null)) break;
        ((h = u),
          (u = h.next),
          (h.next = null),
          (l.lastBaseUpdate = h),
          (l.shared.pending = null));
      }
    } while (!0);
    if (
      (v === null && (s = m),
      (l.baseState = s),
      (l.firstBaseUpdate = c),
      (l.lastBaseUpdate = v),
      (t = l.shared.interleaved),
      t !== null)
    ) {
      l = t;
      do ((o |= l.lane), (l = l.next));
      while (l !== t);
    } else i === null && (l.shared.lanes = 0);
    ((zt |= o), (e.lanes = o), (e.memoizedState = m));
  }
}
function wu(e, t, n) {
  if (((e = t.effects), (t.effects = null), e !== null))
    for (t = 0; t < e.length; t++) {
      var r = e[t],
        l = r.callback;
      if (l !== null) {
        if (((r.callback = null), (r = n), typeof l != 'function'))
          throw Error(g(191, l));
        l.call(r);
      }
    }
}
var bn = {},
  $e = mt(bn),
  Wn = mt(bn),
  Hn = mt(bn);
function Et(e) {
  if (e === bn) throw Error(g(174));
  return e;
}
function po(e, t) {
  switch ((O(Hn, t), O(Wn, e), O($e, bn), (e = t.nodeType), e)) {
    case 9:
    case 11:
      t = (t = t.documentElement) ? t.namespaceURI : ti(null, '');
      break;
    default:
      ((e = e === 8 ? t.parentNode : t),
        (t = e.namespaceURI || null),
        (e = e.tagName),
        (t = ti(t, e)));
  }
  (F($e), O($e, t));
}
function nn() {
  (F($e), F(Wn), F(Hn));
}
function la(e) {
  Et(Hn.current);
  var t = Et($e.current),
    n = ti(t, e.type);
  t !== n && (O(Wn, e), O($e, n));
}
function ho(e) {
  Wn.current === e && (F($e), F(Wn));
}
var $ = mt(0);
function Yr(e) {
  for (var t = e; t !== null; ) {
    if (t.tag === 13) {
      var n = t.memoizedState;
      if (
        n !== null &&
        ((n = n.dehydrated), n === null || n.data === '$?' || n.data === '$!')
      )
        return t;
    } else if (t.tag === 19 && t.memoizedProps.revealOrder !== void 0) {
      if (t.flags & 128) return t;
    } else if (t.child !== null) {
      ((t.child.return = t), (t = t.child));
      continue;
    }
    if (t === e) break;
    for (; t.sibling === null; ) {
      if (t.return === null || t.return === e) return null;
      t = t.return;
    }
    ((t.sibling.return = t.return), (t = t.sibling));
  }
  return null;
}
var Ul = [];
function mo() {
  for (var e = 0; e < Ul.length; e++)
    Ul[e]._workInProgressVersionPrimary = null;
  Ul.length = 0;
}
var Cr = Ze.ReactCurrentDispatcher,
  Al = Ze.ReactCurrentBatchConfig,
  Pt = 0,
  B = null,
  X = null,
  J = null,
  Xr = !1,
  Pn = !1,
  Qn = 0,
  Xf = 0;
function ne() {
  throw Error(g(321));
}
function vo(e, t) {
  if (t === null) return !1;
  for (var n = 0; n < t.length && n < e.length; n++)
    if (!Ie(e[n], t[n])) return !1;
  return !0;
}
function yo(e, t, n, r, l, i) {
  if (
    ((Pt = i),
    (B = t),
    (t.memoizedState = null),
    (t.updateQueue = null),
    (t.lanes = 0),
    (Cr.current = e === null || e.memoizedState === null ? qf : bf),
    (e = n(r, l)),
    Pn)
  ) {
    i = 0;
    do {
      if (((Pn = !1), (Qn = 0), 25 <= i)) throw Error(g(301));
      ((i += 1),
        (J = X = null),
        (t.updateQueue = null),
        (Cr.current = ed),
        (e = n(r, l)));
    } while (Pn);
  }
  if (
    ((Cr.current = Gr),
    (t = X !== null && X.next !== null),
    (Pt = 0),
    (J = X = B = null),
    (Xr = !1),
    t)
  )
    throw Error(g(300));
  return e;
}
function go() {
  var e = Qn !== 0;
  return ((Qn = 0), e);
}
function Fe() {
  var e = {
    memoizedState: null,
    baseState: null,
    baseQueue: null,
    queue: null,
    next: null,
  };
  return (J === null ? (B.memoizedState = J = e) : (J = J.next = e), J);
}
function _e() {
  if (X === null) {
    var e = B.alternate;
    e = e !== null ? e.memoizedState : null;
  } else e = X.next;
  var t = J === null ? B.memoizedState : J.next;
  if (t !== null) ((J = t), (X = e));
  else {
    if (e === null) throw Error(g(310));
    ((X = e),
      (e = {
        memoizedState: X.memoizedState,
        baseState: X.baseState,
        baseQueue: X.baseQueue,
        queue: X.queue,
        next: null,
      }),
      J === null ? (B.memoizedState = J = e) : (J = J.next = e));
  }
  return J;
}
function Kn(e, t) {
  return typeof t == 'function' ? t(e) : t;
}
function $l(e) {
  var t = _e(),
    n = t.queue;
  if (n === null) throw Error(g(311));
  n.lastRenderedReducer = e;
  var r = X,
    l = r.baseQueue,
    i = n.pending;
  if (i !== null) {
    if (l !== null) {
      var o = l.next;
      ((l.next = i.next), (i.next = o));
    }
    ((r.baseQueue = l = i), (n.pending = null));
  }
  if (l !== null) {
    ((i = l.next), (r = r.baseState));
    var u = (o = null),
      s = null,
      c = i;
    do {
      var v = c.lane;
      if ((Pt & v) === v)
        (s !== null &&
          (s = s.next =
            {
              lane: 0,
              action: c.action,
              hasEagerState: c.hasEagerState,
              eagerState: c.eagerState,
              next: null,
            }),
          (r = c.hasEagerState ? c.eagerState : e(r, c.action)));
      else {
        var m = {
          lane: v,
          action: c.action,
          hasEagerState: c.hasEagerState,
          eagerState: c.eagerState,
          next: null,
        };
        (s === null ? ((u = s = m), (o = r)) : (s = s.next = m),
          (B.lanes |= v),
          (zt |= v));
      }
      c = c.next;
    } while (c !== null && c !== i);
    (s === null ? (o = r) : (s.next = u),
      Ie(r, t.memoizedState) || (fe = !0),
      (t.memoizedState = r),
      (t.baseState = o),
      (t.baseQueue = s),
      (n.lastRenderedState = r));
  }
  if (((e = n.interleaved), e !== null)) {
    l = e;
    do ((i = l.lane), (B.lanes |= i), (zt |= i), (l = l.next));
    while (l !== e);
  } else l === null && (n.lanes = 0);
  return [t.memoizedState, n.dispatch];
}
function Bl(e) {
  var t = _e(),
    n = t.queue;
  if (n === null) throw Error(g(311));
  n.lastRenderedReducer = e;
  var r = n.dispatch,
    l = n.pending,
    i = t.memoizedState;
  if (l !== null) {
    n.pending = null;
    var o = (l = l.next);
    do ((i = e(i, o.action)), (o = o.next));
    while (o !== l);
    (Ie(i, t.memoizedState) || (fe = !0),
      (t.memoizedState = i),
      t.baseQueue === null && (t.baseState = i),
      (n.lastRenderedState = i));
  }
  return [i, r];
}
function ia() {}
function oa(e, t) {
  var n = B,
    r = _e(),
    l = t(),
    i = !Ie(r.memoizedState, l);
  if (
    (i && ((r.memoizedState = l), (fe = !0)),
    (r = r.queue),
    wo(aa.bind(null, n, r, e), [e]),
    r.getSnapshot !== t || i || (J !== null && J.memoizedState.tag & 1))
  ) {
    if (
      ((n.flags |= 2048),
      Yn(9, sa.bind(null, n, r, l, t), void 0, null),
      q === null)
    )
      throw Error(g(349));
    Pt & 30 || ua(n, t, l);
  }
  return l;
}
function ua(e, t, n) {
  ((e.flags |= 16384),
    (e = { getSnapshot: t, value: n }),
    (t = B.updateQueue),
    t === null
      ? ((t = { lastEffect: null, stores: null }),
        (B.updateQueue = t),
        (t.stores = [e]))
      : ((n = t.stores), n === null ? (t.stores = [e]) : n.push(e)));
}
function sa(e, t, n, r) {
  ((t.value = n), (t.getSnapshot = r), ca(t) && fa(e));
}
function aa(e, t, n) {
  return n(function () {
    ca(t) && fa(e);
  });
}
function ca(e) {
  var t = e.getSnapshot;
  e = e.value;
  try {
    var n = t();
    return !Ie(e, n);
  } catch {
    return !0;
  }
}
function fa(e) {
  var t = Xe(e, 1);
  t !== null && Me(t, e, 1, -1);
}
function ku(e) {
  var t = Fe();
  return (
    typeof e == 'function' && (e = e()),
    (t.memoizedState = t.baseState = e),
    (e = {
      pending: null,
      interleaved: null,
      lanes: 0,
      dispatch: null,
      lastRenderedReducer: Kn,
      lastRenderedState: e,
    }),
    (t.queue = e),
    (e = e.dispatch = Jf.bind(null, B, e)),
    [t.memoizedState, e]
  );
}
function Yn(e, t, n, r) {
  return (
    (e = { tag: e, create: t, destroy: n, deps: r, next: null }),
    (t = B.updateQueue),
    t === null
      ? ((t = { lastEffect: null, stores: null }),
        (B.updateQueue = t),
        (t.lastEffect = e.next = e))
      : ((n = t.lastEffect),
        n === null
          ? (t.lastEffect = e.next = e)
          : ((r = n.next), (n.next = e), (e.next = r), (t.lastEffect = e))),
    e
  );
}
function da() {
  return _e().memoizedState;
}
function _r(e, t, n, r) {
  var l = Fe();
  ((B.flags |= e),
    (l.memoizedState = Yn(1 | t, n, void 0, r === void 0 ? null : r)));
}
function ul(e, t, n, r) {
  var l = _e();
  r = r === void 0 ? null : r;
  var i = void 0;
  if (X !== null) {
    var o = X.memoizedState;
    if (((i = o.destroy), r !== null && vo(r, o.deps))) {
      l.memoizedState = Yn(t, n, i, r);
      return;
    }
  }
  ((B.flags |= e), (l.memoizedState = Yn(1 | t, n, i, r)));
}
function Su(e, t) {
  return _r(8390656, 8, e, t);
}
function wo(e, t) {
  return ul(2048, 8, e, t);
}
function pa(e, t) {
  return ul(4, 2, e, t);
}
function ha(e, t) {
  return ul(4, 4, e, t);
}
function ma(e, t) {
  if (typeof t == 'function')
    return (
      (e = e()),
      t(e),
      function () {
        t(null);
      }
    );
  if (t != null)
    return (
      (e = e()),
      (t.current = e),
      function () {
        t.current = null;
      }
    );
}
function va(e, t, n) {
  return (
    (n = n != null ? n.concat([e]) : null),
    ul(4, 4, ma.bind(null, t, e), n)
  );
}
function ko() {}
function ya(e, t) {
  var n = _e();
  t = t === void 0 ? null : t;
  var r = n.memoizedState;
  return r !== null && t !== null && vo(t, r[1])
    ? r[0]
    : ((n.memoizedState = [e, t]), e);
}
function ga(e, t) {
  var n = _e();
  t = t === void 0 ? null : t;
  var r = n.memoizedState;
  return r !== null && t !== null && vo(t, r[1])
    ? r[0]
    : ((e = e()), (n.memoizedState = [e, t]), e);
}
function wa(e, t, n) {
  return Pt & 21
    ? (Ie(n, t) || ((n = Ns()), (B.lanes |= n), (zt |= n), (e.baseState = !0)),
      t)
    : (e.baseState && ((e.baseState = !1), (fe = !0)), (e.memoizedState = n));
}
function Gf(e, t) {
  var n = I;
  ((I = n !== 0 && 4 > n ? n : 4), e(!0));
  var r = Al.transition;
  Al.transition = {};
  try {
    (e(!1), t());
  } finally {
    ((I = n), (Al.transition = r));
  }
}
function ka() {
  return _e().memoizedState;
}
function Zf(e, t, n) {
  var r = ct(e);
  if (
    ((n = {
      lane: r,
      action: n,
      hasEagerState: !1,
      eagerState: null,
      next: null,
    }),
    Sa(e))
  )
    xa(t, n);
  else if (((n = na(e, t, n, r)), n !== null)) {
    var l = ue();
    (Me(n, e, r, l), Ea(n, t, r));
  }
}
function Jf(e, t, n) {
  var r = ct(e),
    l = { lane: r, action: n, hasEagerState: !1, eagerState: null, next: null };
  if (Sa(e)) xa(t, l);
  else {
    var i = e.alternate;
    if (
      e.lanes === 0 &&
      (i === null || i.lanes === 0) &&
      ((i = t.lastRenderedReducer), i !== null)
    )
      try {
        var o = t.lastRenderedState,
          u = i(o, n);
        if (((l.hasEagerState = !0), (l.eagerState = u), Ie(u, o))) {
          var s = t.interleaved;
          (s === null
            ? ((l.next = l), co(t))
            : ((l.next = s.next), (s.next = l)),
            (t.interleaved = l));
          return;
        }
      } catch {
      } finally {
      }
    ((n = na(e, t, l, r)),
      n !== null && ((l = ue()), Me(n, e, r, l), Ea(n, t, r)));
  }
}
function Sa(e) {
  var t = e.alternate;
  return e === B || (t !== null && t === B);
}
function xa(e, t) {
  Pn = Xr = !0;
  var n = e.pending;
  (n === null ? (t.next = t) : ((t.next = n.next), (n.next = t)),
    (e.pending = t));
}
function Ea(e, t, n) {
  if (n & 4194240) {
    var r = t.lanes;
    ((r &= e.pendingLanes), (n |= r), (t.lanes = n), Zi(e, n));
  }
}
var Gr = {
    readContext: Ce,
    useCallback: ne,
    useContext: ne,
    useEffect: ne,
    useImperativeHandle: ne,
    useInsertionEffect: ne,
    useLayoutEffect: ne,
    useMemo: ne,
    useReducer: ne,
    useRef: ne,
    useState: ne,
    useDebugValue: ne,
    useDeferredValue: ne,
    useTransition: ne,
    useMutableSource: ne,
    useSyncExternalStore: ne,
    useId: ne,
    unstable_isNewReconciler: !1,
  },
  qf = {
    readContext: Ce,
    useCallback: function (e, t) {
      return ((Fe().memoizedState = [e, t === void 0 ? null : t]), e);
    },
    useContext: Ce,
    useEffect: Su,
    useImperativeHandle: function (e, t, n) {
      return (
        (n = n != null ? n.concat([e]) : null),
        _r(4194308, 4, ma.bind(null, t, e), n)
      );
    },
    useLayoutEffect: function (e, t) {
      return _r(4194308, 4, e, t);
    },
    useInsertionEffect: function (e, t) {
      return _r(4, 2, e, t);
    },
    useMemo: function (e, t) {
      var n = Fe();
      return (
        (t = t === void 0 ? null : t),
        (e = e()),
        (n.memoizedState = [e, t]),
        e
      );
    },
    useReducer: function (e, t, n) {
      var r = Fe();
      return (
        (t = n !== void 0 ? n(t) : t),
        (r.memoizedState = r.baseState = t),
        (e = {
          pending: null,
          interleaved: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: e,
          lastRenderedState: t,
        }),
        (r.queue = e),
        (e = e.dispatch = Zf.bind(null, B, e)),
        [r.memoizedState, e]
      );
    },
    useRef: function (e) {
      var t = Fe();
      return ((e = { current: e }), (t.memoizedState = e));
    },
    useState: ku,
    useDebugValue: ko,
    useDeferredValue: function (e) {
      return (Fe().memoizedState = e);
    },
    useTransition: function () {
      var e = ku(!1),
        t = e[0];
      return ((e = Gf.bind(null, e[1])), (Fe().memoizedState = e), [t, e]);
    },
    useMutableSource: function () {},
    useSyncExternalStore: function (e, t, n) {
      var r = B,
        l = Fe();
      if (A) {
        if (n === void 0) throw Error(g(407));
        n = n();
      } else {
        if (((n = t()), q === null)) throw Error(g(349));
        Pt & 30 || ua(r, t, n);
      }
      l.memoizedState = n;
      var i = { value: n, getSnapshot: t };
      return (
        (l.queue = i),
        Su(aa.bind(null, r, i, e), [e]),
        (r.flags |= 2048),
        Yn(9, sa.bind(null, r, i, n, t), void 0, null),
        n
      );
    },
    useId: function () {
      var e = Fe(),
        t = q.identifierPrefix;
      if (A) {
        var n = He,
          r = We;
        ((n = (r & ~(1 << (32 - Re(r) - 1))).toString(32) + n),
          (t = ':' + t + 'R' + n),
          (n = Qn++),
          0 < n && (t += 'H' + n.toString(32)),
          (t += ':'));
      } else ((n = Xf++), (t = ':' + t + 'r' + n.toString(32) + ':'));
      return (e.memoizedState = t);
    },
    unstable_isNewReconciler: !1,
  },
  bf = {
    readContext: Ce,
    useCallback: ya,
    useContext: Ce,
    useEffect: wo,
    useImperativeHandle: va,
    useInsertionEffect: pa,
    useLayoutEffect: ha,
    useMemo: ga,
    useReducer: $l,
    useRef: da,
    useState: function () {
      return $l(Kn);
    },
    useDebugValue: ko,
    useDeferredValue: function (e) {
      var t = _e();
      return wa(t, X.memoizedState, e);
    },
    useTransition: function () {
      var e = $l(Kn)[0],
        t = _e().memoizedState;
      return [e, t];
    },
    useMutableSource: ia,
    useSyncExternalStore: oa,
    useId: ka,
    unstable_isNewReconciler: !1,
  },
  ed = {
    readContext: Ce,
    useCallback: ya,
    useContext: Ce,
    useEffect: wo,
    useImperativeHandle: va,
    useInsertionEffect: pa,
    useLayoutEffect: ha,
    useMemo: ga,
    useReducer: Bl,
    useRef: da,
    useState: function () {
      return Bl(Kn);
    },
    useDebugValue: ko,
    useDeferredValue: function (e) {
      var t = _e();
      return X === null ? (t.memoizedState = e) : wa(t, X.memoizedState, e);
    },
    useTransition: function () {
      var e = Bl(Kn)[0],
        t = _e().memoizedState;
      return [e, t];
    },
    useMutableSource: ia,
    useSyncExternalStore: oa,
    useId: ka,
    unstable_isNewReconciler: !1,
  };
function ze(e, t) {
  if (e && e.defaultProps) {
    ((t = V({}, t)), (e = e.defaultProps));
    for (var n in e) t[n] === void 0 && (t[n] = e[n]);
    return t;
  }
  return t;
}
function xi(e, t, n, r) {
  ((t = e.memoizedState),
    (n = n(r, t)),
    (n = n == null ? t : V({}, t, n)),
    (e.memoizedState = n),
    e.lanes === 0 && (e.updateQueue.baseState = n));
}
var sl = {
  isMounted: function (e) {
    return (e = e._reactInternals) ? Rt(e) === e : !1;
  },
  enqueueSetState: function (e, t, n) {
    e = e._reactInternals;
    var r = ue(),
      l = ct(e),
      i = Qe(r, l);
    ((i.payload = t),
      n != null && (i.callback = n),
      (t = st(e, i, l)),
      t !== null && (Me(t, e, l, r), Nr(t, e, l)));
  },
  enqueueReplaceState: function (e, t, n) {
    e = e._reactInternals;
    var r = ue(),
      l = ct(e),
      i = Qe(r, l);
    ((i.tag = 1),
      (i.payload = t),
      n != null && (i.callback = n),
      (t = st(e, i, l)),
      t !== null && (Me(t, e, l, r), Nr(t, e, l)));
  },
  enqueueForceUpdate: function (e, t) {
    e = e._reactInternals;
    var n = ue(),
      r = ct(e),
      l = Qe(n, r);
    ((l.tag = 2),
      t != null && (l.callback = t),
      (t = st(e, l, r)),
      t !== null && (Me(t, e, r, n), Nr(t, e, r)));
  },
};
function xu(e, t, n, r, l, i, o) {
  return (
    (e = e.stateNode),
    typeof e.shouldComponentUpdate == 'function'
      ? e.shouldComponentUpdate(r, i, o)
      : t.prototype && t.prototype.isPureReactComponent
        ? !An(n, r) || !An(l, i)
        : !0
  );
}
function Na(e, t, n) {
  var r = !1,
    l = pt,
    i = t.contextType;
  return (
    typeof i == 'object' && i !== null
      ? (i = Ce(i))
      : ((l = pe(t) ? _t : ie.current),
        (r = t.contextTypes),
        (i = (r = r != null) ? bt(e, l) : pt)),
    (t = new t(n, i)),
    (e.memoizedState = t.state !== null && t.state !== void 0 ? t.state : null),
    (t.updater = sl),
    (e.stateNode = t),
    (t._reactInternals = e),
    r &&
      ((e = e.stateNode),
      (e.__reactInternalMemoizedUnmaskedChildContext = l),
      (e.__reactInternalMemoizedMaskedChildContext = i)),
    t
  );
}
function Eu(e, t, n, r) {
  ((e = t.state),
    typeof t.componentWillReceiveProps == 'function' &&
      t.componentWillReceiveProps(n, r),
    typeof t.UNSAFE_componentWillReceiveProps == 'function' &&
      t.UNSAFE_componentWillReceiveProps(n, r),
    t.state !== e && sl.enqueueReplaceState(t, t.state, null));
}
function Ei(e, t, n, r) {
  var l = e.stateNode;
  ((l.props = n), (l.state = e.memoizedState), (l.refs = {}), fo(e));
  var i = t.contextType;
  (typeof i == 'object' && i !== null
    ? (l.context = Ce(i))
    : ((i = pe(t) ? _t : ie.current), (l.context = bt(e, i))),
    (l.state = e.memoizedState),
    (i = t.getDerivedStateFromProps),
    typeof i == 'function' && (xi(e, t, i, n), (l.state = e.memoizedState)),
    typeof t.getDerivedStateFromProps == 'function' ||
      typeof l.getSnapshotBeforeUpdate == 'function' ||
      (typeof l.UNSAFE_componentWillMount != 'function' &&
        typeof l.componentWillMount != 'function') ||
      ((t = l.state),
      typeof l.componentWillMount == 'function' && l.componentWillMount(),
      typeof l.UNSAFE_componentWillMount == 'function' &&
        l.UNSAFE_componentWillMount(),
      t !== l.state && sl.enqueueReplaceState(l, l.state, null),
      Kr(e, n, l, r),
      (l.state = e.memoizedState)),
    typeof l.componentDidMount == 'function' && (e.flags |= 4194308));
}
function rn(e, t) {
  try {
    var n = '',
      r = t;
    do ((n += jc(r)), (r = r.return));
    while (r);
    var l = n;
  } catch (i) {
    l =
      `
Error generating stack: ` +
      i.message +
      `
` +
      i.stack;
  }
  return { value: e, source: t, stack: l, digest: null };
}
function Vl(e, t, n) {
  return { value: e, source: null, stack: n ?? null, digest: t ?? null };
}
function Ni(e, t) {
  try {
    console.error(t.value);
  } catch (n) {
    setTimeout(function () {
      throw n;
    });
  }
}
var td = typeof WeakMap == 'function' ? WeakMap : Map;
function Ca(e, t, n) {
  ((n = Qe(-1, n)), (n.tag = 3), (n.payload = { element: null }));
  var r = t.value;
  return (
    (n.callback = function () {
      (Jr || ((Jr = !0), (Ii = r)), Ni(e, t));
    }),
    n
  );
}
function _a(e, t, n) {
  ((n = Qe(-1, n)), (n.tag = 3));
  var r = e.type.getDerivedStateFromError;
  if (typeof r == 'function') {
    var l = t.value;
    ((n.payload = function () {
      return r(l);
    }),
      (n.callback = function () {
        Ni(e, t);
      }));
  }
  var i = e.stateNode;
  return (
    i !== null &&
      typeof i.componentDidCatch == 'function' &&
      (n.callback = function () {
        (Ni(e, t),
          typeof r != 'function' &&
            (at === null ? (at = new Set([this])) : at.add(this)));
        var o = t.stack;
        this.componentDidCatch(t.value, {
          componentStack: o !== null ? o : '',
        });
      }),
    n
  );
}
function Nu(e, t, n) {
  var r = e.pingCache;
  if (r === null) {
    r = e.pingCache = new td();
    var l = new Set();
    r.set(t, l);
  } else ((l = r.get(t)), l === void 0 && ((l = new Set()), r.set(t, l)));
  l.has(n) || (l.add(n), (e = md.bind(null, e, t, n)), t.then(e, e));
}
function Cu(e) {
  do {
    var t;
    if (
      ((t = e.tag === 13) &&
        ((t = e.memoizedState), (t = t !== null ? t.dehydrated !== null : !0)),
      t)
    )
      return e;
    e = e.return;
  } while (e !== null);
  return null;
}
function _u(e, t, n, r, l) {
  return e.mode & 1
    ? ((e.flags |= 65536), (e.lanes = l), e)
    : (e === t
        ? (e.flags |= 65536)
        : ((e.flags |= 128),
          (n.flags |= 131072),
          (n.flags &= -52805),
          n.tag === 1 &&
            (n.alternate === null
              ? (n.tag = 17)
              : ((t = Qe(-1, 1)), (t.tag = 2), st(n, t, 1))),
          (n.lanes |= 1)),
      e);
}
var nd = Ze.ReactCurrentOwner,
  fe = !1;
function oe(e, t, n, r) {
  t.child = e === null ? ta(t, null, n, r) : tn(t, e.child, n, r);
}
function ju(e, t, n, r, l) {
  n = n.render;
  var i = t.ref;
  return (
    Zt(t, l),
    (r = yo(e, t, n, r, i, l)),
    (n = go()),
    e !== null && !fe
      ? ((t.updateQueue = e.updateQueue),
        (t.flags &= -2053),
        (e.lanes &= ~l),
        Ge(e, t, l))
      : (A && n && lo(t), (t.flags |= 1), oe(e, t, r, l), t.child)
  );
}
function Pu(e, t, n, r, l) {
  if (e === null) {
    var i = n.type;
    return typeof i == 'function' &&
      !Po(i) &&
      i.defaultProps === void 0 &&
      n.compare === null &&
      n.defaultProps === void 0
      ? ((t.tag = 15), (t.type = i), ja(e, t, i, r, l))
      : ((e = Lr(n.type, null, r, t, t.mode, l)),
        (e.ref = t.ref),
        (e.return = t),
        (t.child = e));
  }
  if (((i = e.child), !(e.lanes & l))) {
    var o = i.memoizedProps;
    if (
      ((n = n.compare), (n = n !== null ? n : An), n(o, r) && e.ref === t.ref)
    )
      return Ge(e, t, l);
  }
  return (
    (t.flags |= 1),
    (e = ft(i, r)),
    (e.ref = t.ref),
    (e.return = t),
    (t.child = e)
  );
}
function ja(e, t, n, r, l) {
  if (e !== null) {
    var i = e.memoizedProps;
    if (An(i, r) && e.ref === t.ref)
      if (((fe = !1), (t.pendingProps = r = i), (e.lanes & l) !== 0))
        e.flags & 131072 && (fe = !0);
      else return ((t.lanes = e.lanes), Ge(e, t, l));
  }
  return Ci(e, t, n, r, l);
}
function Pa(e, t, n) {
  var r = t.pendingProps,
    l = r.children,
    i = e !== null ? e.memoizedState : null;
  if (r.mode === 'hidden')
    if (!(t.mode & 1))
      ((t.memoizedState = { baseLanes: 0, cachePool: null, transitions: null }),
        O(Qt, me),
        (me |= n));
    else {
      if (!(n & 1073741824))
        return (
          (e = i !== null ? i.baseLanes | n : n),
          (t.lanes = t.childLanes = 1073741824),
          (t.memoizedState = {
            baseLanes: e,
            cachePool: null,
            transitions: null,
          }),
          (t.updateQueue = null),
          O(Qt, me),
          (me |= e),
          null
        );
      ((t.memoizedState = { baseLanes: 0, cachePool: null, transitions: null }),
        (r = i !== null ? i.baseLanes : n),
        O(Qt, me),
        (me |= r));
    }
  else
    (i !== null ? ((r = i.baseLanes | n), (t.memoizedState = null)) : (r = n),
      O(Qt, me),
      (me |= r));
  return (oe(e, t, l, n), t.child);
}
function za(e, t) {
  var n = t.ref;
  ((e === null && n !== null) || (e !== null && e.ref !== n)) &&
    ((t.flags |= 512), (t.flags |= 2097152));
}
function Ci(e, t, n, r, l) {
  var i = pe(n) ? _t : ie.current;
  return (
    (i = bt(t, i)),
    Zt(t, l),
    (n = yo(e, t, n, r, i, l)),
    (r = go()),
    e !== null && !fe
      ? ((t.updateQueue = e.updateQueue),
        (t.flags &= -2053),
        (e.lanes &= ~l),
        Ge(e, t, l))
      : (A && r && lo(t), (t.flags |= 1), oe(e, t, n, l), t.child)
  );
}
function zu(e, t, n, r, l) {
  if (pe(n)) {
    var i = !0;
    Br(t);
  } else i = !1;
  if ((Zt(t, l), t.stateNode === null))
    (jr(e, t), Na(t, n, r), Ei(t, n, r, l), (r = !0));
  else if (e === null) {
    var o = t.stateNode,
      u = t.memoizedProps;
    o.props = u;
    var s = o.context,
      c = n.contextType;
    typeof c == 'object' && c !== null
      ? (c = Ce(c))
      : ((c = pe(n) ? _t : ie.current), (c = bt(t, c)));
    var v = n.getDerivedStateFromProps,
      m =
        typeof v == 'function' ||
        typeof o.getSnapshotBeforeUpdate == 'function';
    (m ||
      (typeof o.UNSAFE_componentWillReceiveProps != 'function' &&
        typeof o.componentWillReceiveProps != 'function') ||
      ((u !== r || s !== c) && Eu(t, o, r, c)),
      (be = !1));
    var h = t.memoizedState;
    ((o.state = h),
      Kr(t, r, o, l),
      (s = t.memoizedState),
      u !== r || h !== s || de.current || be
        ? (typeof v == 'function' && (xi(t, n, v, r), (s = t.memoizedState)),
          (u = be || xu(t, n, u, r, h, s, c))
            ? (m ||
                (typeof o.UNSAFE_componentWillMount != 'function' &&
                  typeof o.componentWillMount != 'function') ||
                (typeof o.componentWillMount == 'function' &&
                  o.componentWillMount(),
                typeof o.UNSAFE_componentWillMount == 'function' &&
                  o.UNSAFE_componentWillMount()),
              typeof o.componentDidMount == 'function' && (t.flags |= 4194308))
            : (typeof o.componentDidMount == 'function' && (t.flags |= 4194308),
              (t.memoizedProps = r),
              (t.memoizedState = s)),
          (o.props = r),
          (o.state = s),
          (o.context = c),
          (r = u))
        : (typeof o.componentDidMount == 'function' && (t.flags |= 4194308),
          (r = !1)));
  } else {
    ((o = t.stateNode),
      ra(e, t),
      (u = t.memoizedProps),
      (c = t.type === t.elementType ? u : ze(t.type, u)),
      (o.props = c),
      (m = t.pendingProps),
      (h = o.context),
      (s = n.contextType),
      typeof s == 'object' && s !== null
        ? (s = Ce(s))
        : ((s = pe(n) ? _t : ie.current), (s = bt(t, s))));
    var S = n.getDerivedStateFromProps;
    ((v =
      typeof S == 'function' ||
      typeof o.getSnapshotBeforeUpdate == 'function') ||
      (typeof o.UNSAFE_componentWillReceiveProps != 'function' &&
        typeof o.componentWillReceiveProps != 'function') ||
      ((u !== m || h !== s) && Eu(t, o, r, s)),
      (be = !1),
      (h = t.memoizedState),
      (o.state = h),
      Kr(t, r, o, l));
    var w = t.memoizedState;
    u !== m || h !== w || de.current || be
      ? (typeof S == 'function' && (xi(t, n, S, r), (w = t.memoizedState)),
        (c = be || xu(t, n, c, r, h, w, s) || !1)
          ? (v ||
              (typeof o.UNSAFE_componentWillUpdate != 'function' &&
                typeof o.componentWillUpdate != 'function') ||
              (typeof o.componentWillUpdate == 'function' &&
                o.componentWillUpdate(r, w, s),
              typeof o.UNSAFE_componentWillUpdate == 'function' &&
                o.UNSAFE_componentWillUpdate(r, w, s)),
            typeof o.componentDidUpdate == 'function' && (t.flags |= 4),
            typeof o.getSnapshotBeforeUpdate == 'function' && (t.flags |= 1024))
          : (typeof o.componentDidUpdate != 'function' ||
              (u === e.memoizedProps && h === e.memoizedState) ||
              (t.flags |= 4),
            typeof o.getSnapshotBeforeUpdate != 'function' ||
              (u === e.memoizedProps && h === e.memoizedState) ||
              (t.flags |= 1024),
            (t.memoizedProps = r),
            (t.memoizedState = w)),
        (o.props = r),
        (o.state = w),
        (o.context = s),
        (r = c))
      : (typeof o.componentDidUpdate != 'function' ||
          (u === e.memoizedProps && h === e.memoizedState) ||
          (t.flags |= 4),
        typeof o.getSnapshotBeforeUpdate != 'function' ||
          (u === e.memoizedProps && h === e.memoizedState) ||
          (t.flags |= 1024),
        (r = !1));
  }
  return _i(e, t, n, r, i, l);
}
function _i(e, t, n, r, l, i) {
  za(e, t);
  var o = (t.flags & 128) !== 0;
  if (!r && !o) return (l && hu(t, n, !1), Ge(e, t, i));
  ((r = t.stateNode), (nd.current = t));
  var u =
    o && typeof n.getDerivedStateFromError != 'function' ? null : r.render();
  return (
    (t.flags |= 1),
    e !== null && o
      ? ((t.child = tn(t, e.child, null, i)), (t.child = tn(t, null, u, i)))
      : oe(e, t, u, i),
    (t.memoizedState = r.state),
    l && hu(t, n, !0),
    t.child
  );
}
function La(e) {
  var t = e.stateNode;
  (t.pendingContext
    ? pu(e, t.pendingContext, t.pendingContext !== t.context)
    : t.context && pu(e, t.context, !1),
    po(e, t.containerInfo));
}
function Lu(e, t, n, r, l) {
  return (en(), oo(l), (t.flags |= 256), oe(e, t, n, r), t.child);
}
var ji = { dehydrated: null, treeContext: null, retryLane: 0 };
function Pi(e) {
  return { baseLanes: e, cachePool: null, transitions: null };
}
function Ta(e, t, n) {
  var r = t.pendingProps,
    l = $.current,
    i = !1,
    o = (t.flags & 128) !== 0,
    u;
  if (
    ((u = o) ||
      (u = e !== null && e.memoizedState === null ? !1 : (l & 2) !== 0),
    u
      ? ((i = !0), (t.flags &= -129))
      : (e === null || e.memoizedState !== null) && (l |= 1),
    O($, l & 1),
    e === null)
  )
    return (
      ki(t),
      (e = t.memoizedState),
      e !== null && ((e = e.dehydrated), e !== null)
        ? (t.mode & 1
            ? e.data === '$!'
              ? (t.lanes = 8)
              : (t.lanes = 1073741824)
            : (t.lanes = 1),
          null)
        : ((o = r.children),
          (e = r.fallback),
          i
            ? ((r = t.mode),
              (i = t.child),
              (o = { mode: 'hidden', children: o }),
              !(r & 1) && i !== null
                ? ((i.childLanes = 0), (i.pendingProps = o))
                : (i = fl(o, r, 0, null)),
              (e = Ct(e, r, n, null)),
              (i.return = t),
              (e.return = t),
              (i.sibling = e),
              (t.child = i),
              (t.child.memoizedState = Pi(n)),
              (t.memoizedState = ji),
              e)
            : So(t, o))
    );
  if (((l = e.memoizedState), l !== null && ((u = l.dehydrated), u !== null)))
    return rd(e, t, o, r, u, l, n);
  if (i) {
    ((i = r.fallback), (o = t.mode), (l = e.child), (u = l.sibling));
    var s = { mode: 'hidden', children: r.children };
    return (
      !(o & 1) && t.child !== l
        ? ((r = t.child),
          (r.childLanes = 0),
          (r.pendingProps = s),
          (t.deletions = null))
        : ((r = ft(l, s)), (r.subtreeFlags = l.subtreeFlags & 14680064)),
      u !== null ? (i = ft(u, i)) : ((i = Ct(i, o, n, null)), (i.flags |= 2)),
      (i.return = t),
      (r.return = t),
      (r.sibling = i),
      (t.child = r),
      (r = i),
      (i = t.child),
      (o = e.child.memoizedState),
      (o =
        o === null
          ? Pi(n)
          : {
              baseLanes: o.baseLanes | n,
              cachePool: null,
              transitions: o.transitions,
            }),
      (i.memoizedState = o),
      (i.childLanes = e.childLanes & ~n),
      (t.memoizedState = ji),
      r
    );
  }
  return (
    (i = e.child),
    (e = i.sibling),
    (r = ft(i, { mode: 'visible', children: r.children })),
    !(t.mode & 1) && (r.lanes = n),
    (r.return = t),
    (r.sibling = null),
    e !== null &&
      ((n = t.deletions),
      n === null ? ((t.deletions = [e]), (t.flags |= 16)) : n.push(e)),
    (t.child = r),
    (t.memoizedState = null),
    r
  );
}
function So(e, t) {
  return (
    (t = fl({ mode: 'visible', children: t }, e.mode, 0, null)),
    (t.return = e),
    (e.child = t)
  );
}
function mr(e, t, n, r) {
  return (
    r !== null && oo(r),
    tn(t, e.child, null, n),
    (e = So(t, t.pendingProps.children)),
    (e.flags |= 2),
    (t.memoizedState = null),
    e
  );
}
function rd(e, t, n, r, l, i, o) {
  if (n)
    return t.flags & 256
      ? ((t.flags &= -257), (r = Vl(Error(g(422)))), mr(e, t, o, r))
      : t.memoizedState !== null
        ? ((t.child = e.child), (t.flags |= 128), null)
        : ((i = r.fallback),
          (l = t.mode),
          (r = fl({ mode: 'visible', children: r.children }, l, 0, null)),
          (i = Ct(i, l, o, null)),
          (i.flags |= 2),
          (r.return = t),
          (i.return = t),
          (r.sibling = i),
          (t.child = r),
          t.mode & 1 && tn(t, e.child, null, o),
          (t.child.memoizedState = Pi(o)),
          (t.memoizedState = ji),
          i);
  if (!(t.mode & 1)) return mr(e, t, o, null);
  if (l.data === '$!') {
    if (((r = l.nextSibling && l.nextSibling.dataset), r)) var u = r.dgst;
    return (
      (r = u),
      (i = Error(g(419))),
      (r = Vl(i, r, void 0)),
      mr(e, t, o, r)
    );
  }
  if (((u = (o & e.childLanes) !== 0), fe || u)) {
    if (((r = q), r !== null)) {
      switch (o & -o) {
        case 4:
          l = 2;
          break;
        case 16:
          l = 8;
          break;
        case 64:
        case 128:
        case 256:
        case 512:
        case 1024:
        case 2048:
        case 4096:
        case 8192:
        case 16384:
        case 32768:
        case 65536:
        case 131072:
        case 262144:
        case 524288:
        case 1048576:
        case 2097152:
        case 4194304:
        case 8388608:
        case 16777216:
        case 33554432:
        case 67108864:
          l = 32;
          break;
        case 536870912:
          l = 268435456;
          break;
        default:
          l = 0;
      }
      ((l = l & (r.suspendedLanes | o) ? 0 : l),
        l !== 0 &&
          l !== i.retryLane &&
          ((i.retryLane = l), Xe(e, l), Me(r, e, l, -1)));
    }
    return (jo(), (r = Vl(Error(g(421)))), mr(e, t, o, r));
  }
  return l.data === '$?'
    ? ((t.flags |= 128),
      (t.child = e.child),
      (t = vd.bind(null, e)),
      (l._reactRetry = t),
      null)
    : ((e = i.treeContext),
      (ve = ut(l.nextSibling)),
      (ye = t),
      (A = !0),
      (Te = null),
      e !== null &&
        ((Se[xe++] = We),
        (Se[xe++] = He),
        (Se[xe++] = jt),
        (We = e.id),
        (He = e.overflow),
        (jt = t)),
      (t = So(t, r.children)),
      (t.flags |= 4096),
      t);
}
function Tu(e, t, n) {
  e.lanes |= t;
  var r = e.alternate;
  (r !== null && (r.lanes |= t), Si(e.return, t, n));
}
function Wl(e, t, n, r, l) {
  var i = e.memoizedState;
  i === null
    ? (e.memoizedState = {
        isBackwards: t,
        rendering: null,
        renderingStartTime: 0,
        last: r,
        tail: n,
        tailMode: l,
      })
    : ((i.isBackwards = t),
      (i.rendering = null),
      (i.renderingStartTime = 0),
      (i.last = r),
      (i.tail = n),
      (i.tailMode = l));
}
function Ra(e, t, n) {
  var r = t.pendingProps,
    l = r.revealOrder,
    i = r.tail;
  if ((oe(e, t, r.children, n), (r = $.current), r & 2))
    ((r = (r & 1) | 2), (t.flags |= 128));
  else {
    if (e !== null && e.flags & 128)
      e: for (e = t.child; e !== null; ) {
        if (e.tag === 13) e.memoizedState !== null && Tu(e, n, t);
        else if (e.tag === 19) Tu(e, n, t);
        else if (e.child !== null) {
          ((e.child.return = e), (e = e.child));
          continue;
        }
        if (e === t) break e;
        for (; e.sibling === null; ) {
          if (e.return === null || e.return === t) break e;
          e = e.return;
        }
        ((e.sibling.return = e.return), (e = e.sibling));
      }
    r &= 1;
  }
  if ((O($, r), !(t.mode & 1))) t.memoizedState = null;
  else
    switch (l) {
      case 'forwards':
        for (n = t.child, l = null; n !== null; )
          ((e = n.alternate),
            e !== null && Yr(e) === null && (l = n),
            (n = n.sibling));
        ((n = l),
          n === null
            ? ((l = t.child), (t.child = null))
            : ((l = n.sibling), (n.sibling = null)),
          Wl(t, !1, l, n, i));
        break;
      case 'backwards':
        for (n = null, l = t.child, t.child = null; l !== null; ) {
          if (((e = l.alternate), e !== null && Yr(e) === null)) {
            t.child = l;
            break;
          }
          ((e = l.sibling), (l.sibling = n), (n = l), (l = e));
        }
        Wl(t, !0, n, null, i);
        break;
      case 'together':
        Wl(t, !1, null, null, void 0);
        break;
      default:
        t.memoizedState = null;
    }
  return t.child;
}
function jr(e, t) {
  !(t.mode & 1) &&
    e !== null &&
    ((e.alternate = null), (t.alternate = null), (t.flags |= 2));
}
function Ge(e, t, n) {
  if (
    (e !== null && (t.dependencies = e.dependencies),
    (zt |= t.lanes),
    !(n & t.childLanes))
  )
    return null;
  if (e !== null && t.child !== e.child) throw Error(g(153));
  if (t.child !== null) {
    for (
      e = t.child, n = ft(e, e.pendingProps), t.child = n, n.return = t;
      e.sibling !== null;
    )
      ((e = e.sibling),
        (n = n.sibling = ft(e, e.pendingProps)),
        (n.return = t));
    n.sibling = null;
  }
  return t.child;
}
function ld(e, t, n) {
  switch (t.tag) {
    case 3:
      (La(t), en());
      break;
    case 5:
      la(t);
      break;
    case 1:
      pe(t.type) && Br(t);
      break;
    case 4:
      po(t, t.stateNode.containerInfo);
      break;
    case 10:
      var r = t.type._context,
        l = t.memoizedProps.value;
      (O(Hr, r._currentValue), (r._currentValue = l));
      break;
    case 13:
      if (((r = t.memoizedState), r !== null))
        return r.dehydrated !== null
          ? (O($, $.current & 1), (t.flags |= 128), null)
          : n & t.child.childLanes
            ? Ta(e, t, n)
            : (O($, $.current & 1),
              (e = Ge(e, t, n)),
              e !== null ? e.sibling : null);
      O($, $.current & 1);
      break;
    case 19:
      if (((r = (n & t.childLanes) !== 0), e.flags & 128)) {
        if (r) return Ra(e, t, n);
        t.flags |= 128;
      }
      if (
        ((l = t.memoizedState),
        l !== null &&
          ((l.rendering = null), (l.tail = null), (l.lastEffect = null)),
        O($, $.current),
        r)
      )
        break;
      return null;
    case 22:
    case 23:
      return ((t.lanes = 0), Pa(e, t, n));
  }
  return Ge(e, t, n);
}
var Ma, zi, Ia, Oa;
Ma = function (e, t) {
  for (var n = t.child; n !== null; ) {
    if (n.tag === 5 || n.tag === 6) e.appendChild(n.stateNode);
    else if (n.tag !== 4 && n.child !== null) {
      ((n.child.return = n), (n = n.child));
      continue;
    }
    if (n === t) break;
    for (; n.sibling === null; ) {
      if (n.return === null || n.return === t) return;
      n = n.return;
    }
    ((n.sibling.return = n.return), (n = n.sibling));
  }
};
zi = function () {};
Ia = function (e, t, n, r) {
  var l = e.memoizedProps;
  if (l !== r) {
    ((e = t.stateNode), Et($e.current));
    var i = null;
    switch (n) {
      case 'input':
        ((l = Jl(e, l)), (r = Jl(e, r)), (i = []));
        break;
      case 'select':
        ((l = V({}, l, { value: void 0 })),
          (r = V({}, r, { value: void 0 })),
          (i = []));
        break;
      case 'textarea':
        ((l = ei(e, l)), (r = ei(e, r)), (i = []));
        break;
      default:
        typeof l.onClick != 'function' &&
          typeof r.onClick == 'function' &&
          (e.onclick = Ar);
    }
    ni(n, r);
    var o;
    n = null;
    for (c in l)
      if (!r.hasOwnProperty(c) && l.hasOwnProperty(c) && l[c] != null)
        if (c === 'style') {
          var u = l[c];
          for (o in u) u.hasOwnProperty(o) && (n || (n = {}), (n[o] = ''));
        } else
          c !== 'dangerouslySetInnerHTML' &&
            c !== 'children' &&
            c !== 'suppressContentEditableWarning' &&
            c !== 'suppressHydrationWarning' &&
            c !== 'autoFocus' &&
            (Rn.hasOwnProperty(c)
              ? i || (i = [])
              : (i = i || []).push(c, null));
    for (c in r) {
      var s = r[c];
      if (
        ((u = l != null ? l[c] : void 0),
        r.hasOwnProperty(c) && s !== u && (s != null || u != null))
      )
        if (c === 'style')
          if (u) {
            for (o in u)
              !u.hasOwnProperty(o) ||
                (s && s.hasOwnProperty(o)) ||
                (n || (n = {}), (n[o] = ''));
            for (o in s)
              s.hasOwnProperty(o) &&
                u[o] !== s[o] &&
                (n || (n = {}), (n[o] = s[o]));
          } else (n || (i || (i = []), i.push(c, n)), (n = s));
        else
          c === 'dangerouslySetInnerHTML'
            ? ((s = s ? s.__html : void 0),
              (u = u ? u.__html : void 0),
              s != null && u !== s && (i = i || []).push(c, s))
            : c === 'children'
              ? (typeof s != 'string' && typeof s != 'number') ||
                (i = i || []).push(c, '' + s)
              : c !== 'suppressContentEditableWarning' &&
                c !== 'suppressHydrationWarning' &&
                (Rn.hasOwnProperty(c)
                  ? (s != null && c === 'onScroll' && D('scroll', e),
                    i || u === s || (i = []))
                  : (i = i || []).push(c, s));
    }
    n && (i = i || []).push('style', n);
    var c = i;
    (t.updateQueue = c) && (t.flags |= 4);
  }
};
Oa = function (e, t, n, r) {
  n !== r && (t.flags |= 4);
};
function yn(e, t) {
  if (!A)
    switch (e.tailMode) {
      case 'hidden':
        t = e.tail;
        for (var n = null; t !== null; )
          (t.alternate !== null && (n = t), (t = t.sibling));
        n === null ? (e.tail = null) : (n.sibling = null);
        break;
      case 'collapsed':
        n = e.tail;
        for (var r = null; n !== null; )
          (n.alternate !== null && (r = n), (n = n.sibling));
        r === null
          ? t || e.tail === null
            ? (e.tail = null)
            : (e.tail.sibling = null)
          : (r.sibling = null);
    }
}
function re(e) {
  var t = e.alternate !== null && e.alternate.child === e.child,
    n = 0,
    r = 0;
  if (t)
    for (var l = e.child; l !== null; )
      ((n |= l.lanes | l.childLanes),
        (r |= l.subtreeFlags & 14680064),
        (r |= l.flags & 14680064),
        (l.return = e),
        (l = l.sibling));
  else
    for (l = e.child; l !== null; )
      ((n |= l.lanes | l.childLanes),
        (r |= l.subtreeFlags),
        (r |= l.flags),
        (l.return = e),
        (l = l.sibling));
  return ((e.subtreeFlags |= r), (e.childLanes = n), t);
}
function id(e, t, n) {
  var r = t.pendingProps;
  switch ((io(t), t.tag)) {
    case 2:
    case 16:
    case 15:
    case 0:
    case 11:
    case 7:
    case 8:
    case 12:
    case 9:
    case 14:
      return (re(t), null);
    case 1:
      return (pe(t.type) && $r(), re(t), null);
    case 3:
      return (
        (r = t.stateNode),
        nn(),
        F(de),
        F(ie),
        mo(),
        r.pendingContext &&
          ((r.context = r.pendingContext), (r.pendingContext = null)),
        (e === null || e.child === null) &&
          (pr(t)
            ? (t.flags |= 4)
            : e === null ||
              (e.memoizedState.isDehydrated && !(t.flags & 256)) ||
              ((t.flags |= 1024), Te !== null && (Fi(Te), (Te = null)))),
        zi(e, t),
        re(t),
        null
      );
    case 5:
      ho(t);
      var l = Et(Hn.current);
      if (((n = t.type), e !== null && t.stateNode != null))
        (Ia(e, t, n, r, l),
          e.ref !== t.ref && ((t.flags |= 512), (t.flags |= 2097152)));
      else {
        if (!r) {
          if (t.stateNode === null) throw Error(g(166));
          return (re(t), null);
        }
        if (((e = Et($e.current)), pr(t))) {
          ((r = t.stateNode), (n = t.type));
          var i = t.memoizedProps;
          switch (((r[Ue] = t), (r[Vn] = i), (e = (t.mode & 1) !== 0), n)) {
            case 'dialog':
              (D('cancel', r), D('close', r));
              break;
            case 'iframe':
            case 'object':
            case 'embed':
              D('load', r);
              break;
            case 'video':
            case 'audio':
              for (l = 0; l < xn.length; l++) D(xn[l], r);
              break;
            case 'source':
              D('error', r);
              break;
            case 'img':
            case 'image':
            case 'link':
              (D('error', r), D('load', r));
              break;
            case 'details':
              D('toggle', r);
              break;
            case 'input':
              ($o(r, i), D('invalid', r));
              break;
            case 'select':
              ((r._wrapperState = { wasMultiple: !!i.multiple }),
                D('invalid', r));
              break;
            case 'textarea':
              (Vo(r, i), D('invalid', r));
          }
          (ni(n, i), (l = null));
          for (var o in i)
            if (i.hasOwnProperty(o)) {
              var u = i[o];
              o === 'children'
                ? typeof u == 'string'
                  ? r.textContent !== u &&
                    (i.suppressHydrationWarning !== !0 &&
                      dr(r.textContent, u, e),
                    (l = ['children', u]))
                  : typeof u == 'number' &&
                    r.textContent !== '' + u &&
                    (i.suppressHydrationWarning !== !0 &&
                      dr(r.textContent, u, e),
                    (l = ['children', '' + u]))
                : Rn.hasOwnProperty(o) &&
                  u != null &&
                  o === 'onScroll' &&
                  D('scroll', r);
            }
          switch (n) {
            case 'input':
              (lr(r), Bo(r, i, !0));
              break;
            case 'textarea':
              (lr(r), Wo(r));
              break;
            case 'select':
            case 'option':
              break;
            default:
              typeof i.onClick == 'function' && (r.onclick = Ar);
          }
          ((r = l), (t.updateQueue = r), r !== null && (t.flags |= 4));
        } else {
          ((o = l.nodeType === 9 ? l : l.ownerDocument),
            e === 'http://www.w3.org/1999/xhtml' && (e = as(n)),
            e === 'http://www.w3.org/1999/xhtml'
              ? n === 'script'
                ? ((e = o.createElement('div')),
                  (e.innerHTML = '<script><\/script>'),
                  (e = e.removeChild(e.firstChild)))
                : typeof r.is == 'string'
                  ? (e = o.createElement(n, { is: r.is }))
                  : ((e = o.createElement(n)),
                    n === 'select' &&
                      ((o = e),
                      r.multiple
                        ? (o.multiple = !0)
                        : r.size && (o.size = r.size)))
              : (e = o.createElementNS(e, n)),
            (e[Ue] = t),
            (e[Vn] = r),
            Ma(e, t, !1, !1),
            (t.stateNode = e));
          e: {
            switch (((o = ri(n, r)), n)) {
              case 'dialog':
                (D('cancel', e), D('close', e), (l = r));
                break;
              case 'iframe':
              case 'object':
              case 'embed':
                (D('load', e), (l = r));
                break;
              case 'video':
              case 'audio':
                for (l = 0; l < xn.length; l++) D(xn[l], e);
                l = r;
                break;
              case 'source':
                (D('error', e), (l = r));
                break;
              case 'img':
              case 'image':
              case 'link':
                (D('error', e), D('load', e), (l = r));
                break;
              case 'details':
                (D('toggle', e), (l = r));
                break;
              case 'input':
                ($o(e, r), (l = Jl(e, r)), D('invalid', e));
                break;
              case 'option':
                l = r;
                break;
              case 'select':
                ((e._wrapperState = { wasMultiple: !!r.multiple }),
                  (l = V({}, r, { value: void 0 })),
                  D('invalid', e));
                break;
              case 'textarea':
                (Vo(e, r), (l = ei(e, r)), D('invalid', e));
                break;
              default:
                l = r;
            }
            (ni(n, l), (u = l));
            for (i in u)
              if (u.hasOwnProperty(i)) {
                var s = u[i];
                i === 'style'
                  ? ds(e, s)
                  : i === 'dangerouslySetInnerHTML'
                    ? ((s = s ? s.__html : void 0), s != null && cs(e, s))
                    : i === 'children'
                      ? typeof s == 'string'
                        ? (n !== 'textarea' || s !== '') && Mn(e, s)
                        : typeof s == 'number' && Mn(e, '' + s)
                      : i !== 'suppressContentEditableWarning' &&
                        i !== 'suppressHydrationWarning' &&
                        i !== 'autoFocus' &&
                        (Rn.hasOwnProperty(i)
                          ? s != null && i === 'onScroll' && D('scroll', e)
                          : s != null && Hi(e, i, s, o));
              }
            switch (n) {
              case 'input':
                (lr(e), Bo(e, r, !1));
                break;
              case 'textarea':
                (lr(e), Wo(e));
                break;
              case 'option':
                r.value != null && e.setAttribute('value', '' + dt(r.value));
                break;
              case 'select':
                ((e.multiple = !!r.multiple),
                  (i = r.value),
                  i != null
                    ? Kt(e, !!r.multiple, i, !1)
                    : r.defaultValue != null &&
                      Kt(e, !!r.multiple, r.defaultValue, !0));
                break;
              default:
                typeof l.onClick == 'function' && (e.onclick = Ar);
            }
            switch (n) {
              case 'button':
              case 'input':
              case 'select':
              case 'textarea':
                r = !!r.autoFocus;
                break e;
              case 'img':
                r = !0;
                break e;
              default:
                r = !1;
            }
          }
          r && (t.flags |= 4);
        }
        t.ref !== null && ((t.flags |= 512), (t.flags |= 2097152));
      }
      return (re(t), null);
    case 6:
      if (e && t.stateNode != null) Oa(e, t, e.memoizedProps, r);
      else {
        if (typeof r != 'string' && t.stateNode === null) throw Error(g(166));
        if (((n = Et(Hn.current)), Et($e.current), pr(t))) {
          if (
            ((r = t.stateNode),
            (n = t.memoizedProps),
            (r[Ue] = t),
            (i = r.nodeValue !== n) && ((e = ye), e !== null))
          )
            switch (e.tag) {
              case 3:
                dr(r.nodeValue, n, (e.mode & 1) !== 0);
                break;
              case 5:
                e.memoizedProps.suppressHydrationWarning !== !0 &&
                  dr(r.nodeValue, n, (e.mode & 1) !== 0);
            }
          i && (t.flags |= 4);
        } else
          ((r = (n.nodeType === 9 ? n : n.ownerDocument).createTextNode(r)),
            (r[Ue] = t),
            (t.stateNode = r));
      }
      return (re(t), null);
    case 13:
      if (
        (F($),
        (r = t.memoizedState),
        e === null ||
          (e.memoizedState !== null && e.memoizedState.dehydrated !== null))
      ) {
        if (A && ve !== null && t.mode & 1 && !(t.flags & 128))
          (bs(), en(), (t.flags |= 98560), (i = !1));
        else if (((i = pr(t)), r !== null && r.dehydrated !== null)) {
          if (e === null) {
            if (!i) throw Error(g(318));
            if (
              ((i = t.memoizedState),
              (i = i !== null ? i.dehydrated : null),
              !i)
            )
              throw Error(g(317));
            i[Ue] = t;
          } else
            (en(),
              !(t.flags & 128) && (t.memoizedState = null),
              (t.flags |= 4));
          (re(t), (i = !1));
        } else (Te !== null && (Fi(Te), (Te = null)), (i = !0));
        if (!i) return t.flags & 65536 ? t : null;
      }
      return t.flags & 128
        ? ((t.lanes = n), t)
        : ((r = r !== null),
          r !== (e !== null && e.memoizedState !== null) &&
            r &&
            ((t.child.flags |= 8192),
            t.mode & 1 &&
              (e === null || $.current & 1 ? G === 0 && (G = 3) : jo())),
          t.updateQueue !== null && (t.flags |= 4),
          re(t),
          null);
    case 4:
      return (
        nn(),
        zi(e, t),
        e === null && $n(t.stateNode.containerInfo),
        re(t),
        null
      );
    case 10:
      return (ao(t.type._context), re(t), null);
    case 17:
      return (pe(t.type) && $r(), re(t), null);
    case 19:
      if ((F($), (i = t.memoizedState), i === null)) return (re(t), null);
      if (((r = (t.flags & 128) !== 0), (o = i.rendering), o === null))
        if (r) yn(i, !1);
        else {
          if (G !== 0 || (e !== null && e.flags & 128))
            for (e = t.child; e !== null; ) {
              if (((o = Yr(e)), o !== null)) {
                for (
                  t.flags |= 128,
                    yn(i, !1),
                    r = o.updateQueue,
                    r !== null && ((t.updateQueue = r), (t.flags |= 4)),
                    t.subtreeFlags = 0,
                    r = n,
                    n = t.child;
                  n !== null;
                )
                  ((i = n),
                    (e = r),
                    (i.flags &= 14680066),
                    (o = i.alternate),
                    o === null
                      ? ((i.childLanes = 0),
                        (i.lanes = e),
                        (i.child = null),
                        (i.subtreeFlags = 0),
                        (i.memoizedProps = null),
                        (i.memoizedState = null),
                        (i.updateQueue = null),
                        (i.dependencies = null),
                        (i.stateNode = null))
                      : ((i.childLanes = o.childLanes),
                        (i.lanes = o.lanes),
                        (i.child = o.child),
                        (i.subtreeFlags = 0),
                        (i.deletions = null),
                        (i.memoizedProps = o.memoizedProps),
                        (i.memoizedState = o.memoizedState),
                        (i.updateQueue = o.updateQueue),
                        (i.type = o.type),
                        (e = o.dependencies),
                        (i.dependencies =
                          e === null
                            ? null
                            : {
                                lanes: e.lanes,
                                firstContext: e.firstContext,
                              })),
                    (n = n.sibling));
                return (O($, ($.current & 1) | 2), t.child);
              }
              e = e.sibling;
            }
          i.tail !== null &&
            Q() > ln &&
            ((t.flags |= 128), (r = !0), yn(i, !1), (t.lanes = 4194304));
        }
      else {
        if (!r)
          if (((e = Yr(o)), e !== null)) {
            if (
              ((t.flags |= 128),
              (r = !0),
              (n = e.updateQueue),
              n !== null && ((t.updateQueue = n), (t.flags |= 4)),
              yn(i, !0),
              i.tail === null && i.tailMode === 'hidden' && !o.alternate && !A)
            )
              return (re(t), null);
          } else
            2 * Q() - i.renderingStartTime > ln &&
              n !== 1073741824 &&
              ((t.flags |= 128), (r = !0), yn(i, !1), (t.lanes = 4194304));
        i.isBackwards
          ? ((o.sibling = t.child), (t.child = o))
          : ((n = i.last),
            n !== null ? (n.sibling = o) : (t.child = o),
            (i.last = o));
      }
      return i.tail !== null
        ? ((t = i.tail),
          (i.rendering = t),
          (i.tail = t.sibling),
          (i.renderingStartTime = Q()),
          (t.sibling = null),
          (n = $.current),
          O($, r ? (n & 1) | 2 : n & 1),
          t)
        : (re(t), null);
    case 22:
    case 23:
      return (
        _o(),
        (r = t.memoizedState !== null),
        e !== null && (e.memoizedState !== null) !== r && (t.flags |= 8192),
        r && t.mode & 1
          ? me & 1073741824 && (re(t), t.subtreeFlags & 6 && (t.flags |= 8192))
          : re(t),
        null
      );
    case 24:
      return null;
    case 25:
      return null;
  }
  throw Error(g(156, t.tag));
}
function od(e, t) {
  switch ((io(t), t.tag)) {
    case 1:
      return (
        pe(t.type) && $r(),
        (e = t.flags),
        e & 65536 ? ((t.flags = (e & -65537) | 128), t) : null
      );
    case 3:
      return (
        nn(),
        F(de),
        F(ie),
        mo(),
        (e = t.flags),
        e & 65536 && !(e & 128) ? ((t.flags = (e & -65537) | 128), t) : null
      );
    case 5:
      return (ho(t), null);
    case 13:
      if ((F($), (e = t.memoizedState), e !== null && e.dehydrated !== null)) {
        if (t.alternate === null) throw Error(g(340));
        en();
      }
      return (
        (e = t.flags),
        e & 65536 ? ((t.flags = (e & -65537) | 128), t) : null
      );
    case 19:
      return (F($), null);
    case 4:
      return (nn(), null);
    case 10:
      return (ao(t.type._context), null);
    case 22:
    case 23:
      return (_o(), null);
    case 24:
      return null;
    default:
      return null;
  }
}
var vr = !1,
  le = !1,
  ud = typeof WeakSet == 'function' ? WeakSet : Set,
  N = null;
function Ht(e, t) {
  var n = e.ref;
  if (n !== null)
    if (typeof n == 'function')
      try {
        n(null);
      } catch (r) {
        W(e, t, r);
      }
    else n.current = null;
}
function Li(e, t, n) {
  try {
    n();
  } catch (r) {
    W(e, t, r);
  }
}
var Ru = !1;
function sd(e, t) {
  if (((pi = Dr), (e = $s()), ro(e))) {
    if ('selectionStart' in e)
      var n = { start: e.selectionStart, end: e.selectionEnd };
    else
      e: {
        n = ((n = e.ownerDocument) && n.defaultView) || window;
        var r = n.getSelection && n.getSelection();
        if (r && r.rangeCount !== 0) {
          n = r.anchorNode;
          var l = r.anchorOffset,
            i = r.focusNode;
          r = r.focusOffset;
          try {
            (n.nodeType, i.nodeType);
          } catch {
            n = null;
            break e;
          }
          var o = 0,
            u = -1,
            s = -1,
            c = 0,
            v = 0,
            m = e,
            h = null;
          t: for (;;) {
            for (
              var S;
              m !== n || (l !== 0 && m.nodeType !== 3) || (u = o + l),
                m !== i || (r !== 0 && m.nodeType !== 3) || (s = o + r),
                m.nodeType === 3 && (o += m.nodeValue.length),
                (S = m.firstChild) !== null;
            )
              ((h = m), (m = S));
            for (;;) {
              if (m === e) break t;
              if (
                (h === n && ++c === l && (u = o),
                h === i && ++v === r && (s = o),
                (S = m.nextSibling) !== null)
              )
                break;
              ((m = h), (h = m.parentNode));
            }
            m = S;
          }
          n = u === -1 || s === -1 ? null : { start: u, end: s };
        } else n = null;
      }
    n = n || { start: 0, end: 0 };
  } else n = null;
  for (hi = { focusedElem: e, selectionRange: n }, Dr = !1, N = t; N !== null; )
    if (((t = N), (e = t.child), (t.subtreeFlags & 1028) !== 0 && e !== null))
      ((e.return = t), (N = e));
    else
      for (; N !== null; ) {
        t = N;
        try {
          var w = t.alternate;
          if (t.flags & 1024)
            switch (t.tag) {
              case 0:
              case 11:
              case 15:
                break;
              case 1:
                if (w !== null) {
                  var x = w.memoizedProps,
                    M = w.memoizedState,
                    f = t.stateNode,
                    a = f.getSnapshotBeforeUpdate(
                      t.elementType === t.type ? x : ze(t.type, x),
                      M,
                    );
                  f.__reactInternalSnapshotBeforeUpdate = a;
                }
                break;
              case 3:
                var d = t.stateNode.containerInfo;
                d.nodeType === 1
                  ? (d.textContent = '')
                  : d.nodeType === 9 &&
                    d.documentElement &&
                    d.removeChild(d.documentElement);
                break;
              case 5:
              case 6:
              case 4:
              case 17:
                break;
              default:
                throw Error(g(163));
            }
        } catch (y) {
          W(t, t.return, y);
        }
        if (((e = t.sibling), e !== null)) {
          ((e.return = t.return), (N = e));
          break;
        }
        N = t.return;
      }
  return ((w = Ru), (Ru = !1), w);
}
function zn(e, t, n) {
  var r = t.updateQueue;
  if (((r = r !== null ? r.lastEffect : null), r !== null)) {
    var l = (r = r.next);
    do {
      if ((l.tag & e) === e) {
        var i = l.destroy;
        ((l.destroy = void 0), i !== void 0 && Li(t, n, i));
      }
      l = l.next;
    } while (l !== r);
  }
}
function al(e, t) {
  if (
    ((t = t.updateQueue), (t = t !== null ? t.lastEffect : null), t !== null)
  ) {
    var n = (t = t.next);
    do {
      if ((n.tag & e) === e) {
        var r = n.create;
        n.destroy = r();
      }
      n = n.next;
    } while (n !== t);
  }
}
function Ti(e) {
  var t = e.ref;
  if (t !== null) {
    var n = e.stateNode;
    switch (e.tag) {
      case 5:
        e = n;
        break;
      default:
        e = n;
    }
    typeof t == 'function' ? t(e) : (t.current = e);
  }
}
function Da(e) {
  var t = e.alternate;
  (t !== null && ((e.alternate = null), Da(t)),
    (e.child = null),
    (e.deletions = null),
    (e.sibling = null),
    e.tag === 5 &&
      ((t = e.stateNode),
      t !== null &&
        (delete t[Ue], delete t[Vn], delete t[yi], delete t[Hf], delete t[Qf])),
    (e.stateNode = null),
    (e.return = null),
    (e.dependencies = null),
    (e.memoizedProps = null),
    (e.memoizedState = null),
    (e.pendingProps = null),
    (e.stateNode = null),
    (e.updateQueue = null));
}
function Fa(e) {
  return e.tag === 5 || e.tag === 3 || e.tag === 4;
}
function Mu(e) {
  e: for (;;) {
    for (; e.sibling === null; ) {
      if (e.return === null || Fa(e.return)) return null;
      e = e.return;
    }
    for (
      e.sibling.return = e.return, e = e.sibling;
      e.tag !== 5 && e.tag !== 6 && e.tag !== 18;
    ) {
      if (e.flags & 2 || e.child === null || e.tag === 4) continue e;
      ((e.child.return = e), (e = e.child));
    }
    if (!(e.flags & 2)) return e.stateNode;
  }
}
function Ri(e, t, n) {
  var r = e.tag;
  if (r === 5 || r === 6)
    ((e = e.stateNode),
      t
        ? n.nodeType === 8
          ? n.parentNode.insertBefore(e, t)
          : n.insertBefore(e, t)
        : (n.nodeType === 8
            ? ((t = n.parentNode), t.insertBefore(e, n))
            : ((t = n), t.appendChild(e)),
          (n = n._reactRootContainer),
          n != null || t.onclick !== null || (t.onclick = Ar)));
  else if (r !== 4 && ((e = e.child), e !== null))
    for (Ri(e, t, n), e = e.sibling; e !== null; )
      (Ri(e, t, n), (e = e.sibling));
}
function Mi(e, t, n) {
  var r = e.tag;
  if (r === 5 || r === 6)
    ((e = e.stateNode), t ? n.insertBefore(e, t) : n.appendChild(e));
  else if (r !== 4 && ((e = e.child), e !== null))
    for (Mi(e, t, n), e = e.sibling; e !== null; )
      (Mi(e, t, n), (e = e.sibling));
}
var b = null,
  Le = !1;
function Je(e, t, n) {
  for (n = n.child; n !== null; ) (Ua(e, t, n), (n = n.sibling));
}
function Ua(e, t, n) {
  if (Ae && typeof Ae.onCommitFiberUnmount == 'function')
    try {
      Ae.onCommitFiberUnmount(tl, n);
    } catch {}
  switch (n.tag) {
    case 5:
      le || Ht(n, t);
    case 6:
      var r = b,
        l = Le;
      ((b = null),
        Je(e, t, n),
        (b = r),
        (Le = l),
        b !== null &&
          (Le
            ? ((e = b),
              (n = n.stateNode),
              e.nodeType === 8 ? e.parentNode.removeChild(n) : e.removeChild(n))
            : b.removeChild(n.stateNode)));
      break;
    case 18:
      b !== null &&
        (Le
          ? ((e = b),
            (n = n.stateNode),
            e.nodeType === 8
              ? Dl(e.parentNode, n)
              : e.nodeType === 1 && Dl(e, n),
            Fn(e))
          : Dl(b, n.stateNode));
      break;
    case 4:
      ((r = b),
        (l = Le),
        (b = n.stateNode.containerInfo),
        (Le = !0),
        Je(e, t, n),
        (b = r),
        (Le = l));
      break;
    case 0:
    case 11:
    case 14:
    case 15:
      if (
        !le &&
        ((r = n.updateQueue), r !== null && ((r = r.lastEffect), r !== null))
      ) {
        l = r = r.next;
        do {
          var i = l,
            o = i.destroy;
          ((i = i.tag),
            o !== void 0 && (i & 2 || i & 4) && Li(n, t, o),
            (l = l.next));
        } while (l !== r);
      }
      Je(e, t, n);
      break;
    case 1:
      if (
        !le &&
        (Ht(n, t),
        (r = n.stateNode),
        typeof r.componentWillUnmount == 'function')
      )
        try {
          ((r.props = n.memoizedProps),
            (r.state = n.memoizedState),
            r.componentWillUnmount());
        } catch (u) {
          W(n, t, u);
        }
      Je(e, t, n);
      break;
    case 21:
      Je(e, t, n);
      break;
    case 22:
      n.mode & 1
        ? ((le = (r = le) || n.memoizedState !== null), Je(e, t, n), (le = r))
        : Je(e, t, n);
      break;
    default:
      Je(e, t, n);
  }
}
function Iu(e) {
  var t = e.updateQueue;
  if (t !== null) {
    e.updateQueue = null;
    var n = e.stateNode;
    (n === null && (n = e.stateNode = new ud()),
      t.forEach(function (r) {
        var l = yd.bind(null, e, r);
        n.has(r) || (n.add(r), r.then(l, l));
      }));
  }
}
function Pe(e, t) {
  var n = t.deletions;
  if (n !== null)
    for (var r = 0; r < n.length; r++) {
      var l = n[r];
      try {
        var i = e,
          o = t,
          u = o;
        e: for (; u !== null; ) {
          switch (u.tag) {
            case 5:
              ((b = u.stateNode), (Le = !1));
              break e;
            case 3:
              ((b = u.stateNode.containerInfo), (Le = !0));
              break e;
            case 4:
              ((b = u.stateNode.containerInfo), (Le = !0));
              break e;
          }
          u = u.return;
        }
        if (b === null) throw Error(g(160));
        (Ua(i, o, l), (b = null), (Le = !1));
        var s = l.alternate;
        (s !== null && (s.return = null), (l.return = null));
      } catch (c) {
        W(l, t, c);
      }
    }
  if (t.subtreeFlags & 12854)
    for (t = t.child; t !== null; ) (Aa(t, e), (t = t.sibling));
}
function Aa(e, t) {
  var n = e.alternate,
    r = e.flags;
  switch (e.tag) {
    case 0:
    case 11:
    case 14:
    case 15:
      if ((Pe(t, e), De(e), r & 4)) {
        try {
          (zn(3, e, e.return), al(3, e));
        } catch (x) {
          W(e, e.return, x);
        }
        try {
          zn(5, e, e.return);
        } catch (x) {
          W(e, e.return, x);
        }
      }
      break;
    case 1:
      (Pe(t, e), De(e), r & 512 && n !== null && Ht(n, n.return));
      break;
    case 5:
      if (
        (Pe(t, e),
        De(e),
        r & 512 && n !== null && Ht(n, n.return),
        e.flags & 32)
      ) {
        var l = e.stateNode;
        try {
          Mn(l, '');
        } catch (x) {
          W(e, e.return, x);
        }
      }
      if (r & 4 && ((l = e.stateNode), l != null)) {
        var i = e.memoizedProps,
          o = n !== null ? n.memoizedProps : i,
          u = e.type,
          s = e.updateQueue;
        if (((e.updateQueue = null), s !== null))
          try {
            (u === 'input' && i.type === 'radio' && i.name != null && us(l, i),
              ri(u, o));
            var c = ri(u, i);
            for (o = 0; o < s.length; o += 2) {
              var v = s[o],
                m = s[o + 1];
              v === 'style'
                ? ds(l, m)
                : v === 'dangerouslySetInnerHTML'
                  ? cs(l, m)
                  : v === 'children'
                    ? Mn(l, m)
                    : Hi(l, v, m, c);
            }
            switch (u) {
              case 'input':
                ql(l, i);
                break;
              case 'textarea':
                ss(l, i);
                break;
              case 'select':
                var h = l._wrapperState.wasMultiple;
                l._wrapperState.wasMultiple = !!i.multiple;
                var S = i.value;
                S != null
                  ? Kt(l, !!i.multiple, S, !1)
                  : h !== !!i.multiple &&
                    (i.defaultValue != null
                      ? Kt(l, !!i.multiple, i.defaultValue, !0)
                      : Kt(l, !!i.multiple, i.multiple ? [] : '', !1));
            }
            l[Vn] = i;
          } catch (x) {
            W(e, e.return, x);
          }
      }
      break;
    case 6:
      if ((Pe(t, e), De(e), r & 4)) {
        if (e.stateNode === null) throw Error(g(162));
        ((l = e.stateNode), (i = e.memoizedProps));
        try {
          l.nodeValue = i;
        } catch (x) {
          W(e, e.return, x);
        }
      }
      break;
    case 3:
      if (
        (Pe(t, e), De(e), r & 4 && n !== null && n.memoizedState.isDehydrated)
      )
        try {
          Fn(t.containerInfo);
        } catch (x) {
          W(e, e.return, x);
        }
      break;
    case 4:
      (Pe(t, e), De(e));
      break;
    case 13:
      (Pe(t, e),
        De(e),
        (l = e.child),
        l.flags & 8192 &&
          ((i = l.memoizedState !== null),
          (l.stateNode.isHidden = i),
          !i ||
            (l.alternate !== null && l.alternate.memoizedState !== null) ||
            (No = Q())),
        r & 4 && Iu(e));
      break;
    case 22:
      if (
        ((v = n !== null && n.memoizedState !== null),
        e.mode & 1 ? ((le = (c = le) || v), Pe(t, e), (le = c)) : Pe(t, e),
        De(e),
        r & 8192)
      ) {
        if (
          ((c = e.memoizedState !== null),
          (e.stateNode.isHidden = c) && !v && e.mode & 1)
        )
          for (N = e, v = e.child; v !== null; ) {
            for (m = N = v; N !== null; ) {
              switch (((h = N), (S = h.child), h.tag)) {
                case 0:
                case 11:
                case 14:
                case 15:
                  zn(4, h, h.return);
                  break;
                case 1:
                  Ht(h, h.return);
                  var w = h.stateNode;
                  if (typeof w.componentWillUnmount == 'function') {
                    ((r = h), (n = h.return));
                    try {
                      ((t = r),
                        (w.props = t.memoizedProps),
                        (w.state = t.memoizedState),
                        w.componentWillUnmount());
                    } catch (x) {
                      W(r, n, x);
                    }
                  }
                  break;
                case 5:
                  Ht(h, h.return);
                  break;
                case 22:
                  if (h.memoizedState !== null) {
                    Du(m);
                    continue;
                  }
              }
              S !== null ? ((S.return = h), (N = S)) : Du(m);
            }
            v = v.sibling;
          }
        e: for (v = null, m = e; ; ) {
          if (m.tag === 5) {
            if (v === null) {
              v = m;
              try {
                ((l = m.stateNode),
                  c
                    ? ((i = l.style),
                      typeof i.setProperty == 'function'
                        ? i.setProperty('display', 'none', 'important')
                        : (i.display = 'none'))
                    : ((u = m.stateNode),
                      (s = m.memoizedProps.style),
                      (o =
                        s != null && s.hasOwnProperty('display')
                          ? s.display
                          : null),
                      (u.style.display = fs('display', o))));
              } catch (x) {
                W(e, e.return, x);
              }
            }
          } else if (m.tag === 6) {
            if (v === null)
              try {
                m.stateNode.nodeValue = c ? '' : m.memoizedProps;
              } catch (x) {
                W(e, e.return, x);
              }
          } else if (
            ((m.tag !== 22 && m.tag !== 23) ||
              m.memoizedState === null ||
              m === e) &&
            m.child !== null
          ) {
            ((m.child.return = m), (m = m.child));
            continue;
          }
          if (m === e) break e;
          for (; m.sibling === null; ) {
            if (m.return === null || m.return === e) break e;
            (v === m && (v = null), (m = m.return));
          }
          (v === m && (v = null),
            (m.sibling.return = m.return),
            (m = m.sibling));
        }
      }
      break;
    case 19:
      (Pe(t, e), De(e), r & 4 && Iu(e));
      break;
    case 21:
      break;
    default:
      (Pe(t, e), De(e));
  }
}
function De(e) {
  var t = e.flags;
  if (t & 2) {
    try {
      e: {
        for (var n = e.return; n !== null; ) {
          if (Fa(n)) {
            var r = n;
            break e;
          }
          n = n.return;
        }
        throw Error(g(160));
      }
      switch (r.tag) {
        case 5:
          var l = r.stateNode;
          r.flags & 32 && (Mn(l, ''), (r.flags &= -33));
          var i = Mu(e);
          Mi(e, i, l);
          break;
        case 3:
        case 4:
          var o = r.stateNode.containerInfo,
            u = Mu(e);
          Ri(e, u, o);
          break;
        default:
          throw Error(g(161));
      }
    } catch (s) {
      W(e, e.return, s);
    }
    e.flags &= -3;
  }
  t & 4096 && (e.flags &= -4097);
}
function ad(e, t, n) {
  ((N = e), $a(e));
}
function $a(e, t, n) {
  for (var r = (e.mode & 1) !== 0; N !== null; ) {
    var l = N,
      i = l.child;
    if (l.tag === 22 && r) {
      var o = l.memoizedState !== null || vr;
      if (!o) {
        var u = l.alternate,
          s = (u !== null && u.memoizedState !== null) || le;
        u = vr;
        var c = le;
        if (((vr = o), (le = s) && !c))
          for (N = l; N !== null; )
            ((o = N),
              (s = o.child),
              o.tag === 22 && o.memoizedState !== null
                ? Fu(l)
                : s !== null
                  ? ((s.return = o), (N = s))
                  : Fu(l));
        for (; i !== null; ) ((N = i), $a(i), (i = i.sibling));
        ((N = l), (vr = u), (le = c));
      }
      Ou(e);
    } else
      l.subtreeFlags & 8772 && i !== null ? ((i.return = l), (N = i)) : Ou(e);
  }
}
function Ou(e) {
  for (; N !== null; ) {
    var t = N;
    if (t.flags & 8772) {
      var n = t.alternate;
      try {
        if (t.flags & 8772)
          switch (t.tag) {
            case 0:
            case 11:
            case 15:
              le || al(5, t);
              break;
            case 1:
              var r = t.stateNode;
              if (t.flags & 4 && !le)
                if (n === null) r.componentDidMount();
                else {
                  var l =
                    t.elementType === t.type
                      ? n.memoizedProps
                      : ze(t.type, n.memoizedProps);
                  r.componentDidUpdate(
                    l,
                    n.memoizedState,
                    r.__reactInternalSnapshotBeforeUpdate,
                  );
                }
              var i = t.updateQueue;
              i !== null && wu(t, i, r);
              break;
            case 3:
              var o = t.updateQueue;
              if (o !== null) {
                if (((n = null), t.child !== null))
                  switch (t.child.tag) {
                    case 5:
                      n = t.child.stateNode;
                      break;
                    case 1:
                      n = t.child.stateNode;
                  }
                wu(t, o, n);
              }
              break;
            case 5:
              var u = t.stateNode;
              if (n === null && t.flags & 4) {
                n = u;
                var s = t.memoizedProps;
                switch (t.type) {
                  case 'button':
                  case 'input':
                  case 'select':
                  case 'textarea':
                    s.autoFocus && n.focus();
                    break;
                  case 'img':
                    s.src && (n.src = s.src);
                }
              }
              break;
            case 6:
              break;
            case 4:
              break;
            case 12:
              break;
            case 13:
              if (t.memoizedState === null) {
                var c = t.alternate;
                if (c !== null) {
                  var v = c.memoizedState;
                  if (v !== null) {
                    var m = v.dehydrated;
                    m !== null && Fn(m);
                  }
                }
              }
              break;
            case 19:
            case 17:
            case 21:
            case 22:
            case 23:
            case 25:
              break;
            default:
              throw Error(g(163));
          }
        le || (t.flags & 512 && Ti(t));
      } catch (h) {
        W(t, t.return, h);
      }
    }
    if (t === e) {
      N = null;
      break;
    }
    if (((n = t.sibling), n !== null)) {
      ((n.return = t.return), (N = n));
      break;
    }
    N = t.return;
  }
}
function Du(e) {
  for (; N !== null; ) {
    var t = N;
    if (t === e) {
      N = null;
      break;
    }
    var n = t.sibling;
    if (n !== null) {
      ((n.return = t.return), (N = n));
      break;
    }
    N = t.return;
  }
}
function Fu(e) {
  for (; N !== null; ) {
    var t = N;
    try {
      switch (t.tag) {
        case 0:
        case 11:
        case 15:
          var n = t.return;
          try {
            al(4, t);
          } catch (s) {
            W(t, n, s);
          }
          break;
        case 1:
          var r = t.stateNode;
          if (typeof r.componentDidMount == 'function') {
            var l = t.return;
            try {
              r.componentDidMount();
            } catch (s) {
              W(t, l, s);
            }
          }
          var i = t.return;
          try {
            Ti(t);
          } catch (s) {
            W(t, i, s);
          }
          break;
        case 5:
          var o = t.return;
          try {
            Ti(t);
          } catch (s) {
            W(t, o, s);
          }
      }
    } catch (s) {
      W(t, t.return, s);
    }
    if (t === e) {
      N = null;
      break;
    }
    var u = t.sibling;
    if (u !== null) {
      ((u.return = t.return), (N = u));
      break;
    }
    N = t.return;
  }
}
var cd = Math.ceil,
  Zr = Ze.ReactCurrentDispatcher,
  xo = Ze.ReactCurrentOwner,
  Ne = Ze.ReactCurrentBatchConfig,
  R = 0,
  q = null,
  Y = null,
  ee = 0,
  me = 0,
  Qt = mt(0),
  G = 0,
  Xn = null,
  zt = 0,
  cl = 0,
  Eo = 0,
  Ln = null,
  ce = null,
  No = 0,
  ln = 1 / 0,
  Be = null,
  Jr = !1,
  Ii = null,
  at = null,
  yr = !1,
  rt = null,
  qr = 0,
  Tn = 0,
  Oi = null,
  Pr = -1,
  zr = 0;
function ue() {
  return R & 6 ? Q() : Pr !== -1 ? Pr : (Pr = Q());
}
function ct(e) {
  return e.mode & 1
    ? R & 2 && ee !== 0
      ? ee & -ee
      : Yf.transition !== null
        ? (zr === 0 && (zr = Ns()), zr)
        : ((e = I),
          e !== 0 || ((e = window.event), (e = e === void 0 ? 16 : Ts(e.type))),
          e)
    : 1;
}
function Me(e, t, n, r) {
  if (50 < Tn) throw ((Tn = 0), (Oi = null), Error(g(185)));
  (Zn(e, n, r),
    (!(R & 2) || e !== q) &&
      (e === q && (!(R & 2) && (cl |= n), G === 4 && tt(e, ee)),
      he(e, r),
      n === 1 && R === 0 && !(t.mode & 1) && ((ln = Q() + 500), ol && vt())));
}
function he(e, t) {
  var n = e.callbackNode;
  Kc(e, t);
  var r = Or(e, e === q ? ee : 0);
  if (r === 0)
    (n !== null && Ko(n), (e.callbackNode = null), (e.callbackPriority = 0));
  else if (((t = r & -r), e.callbackPriority !== t)) {
    if ((n != null && Ko(n), t === 1))
      (e.tag === 0 ? Kf(Uu.bind(null, e)) : Zs(Uu.bind(null, e)),
        Vf(function () {
          !(R & 6) && vt();
        }),
        (n = null));
    else {
      switch (Cs(r)) {
        case 1:
          n = Gi;
          break;
        case 4:
          n = xs;
          break;
        case 16:
          n = Ir;
          break;
        case 536870912:
          n = Es;
          break;
        default:
          n = Ir;
      }
      n = Xa(n, Ba.bind(null, e));
    }
    ((e.callbackPriority = t), (e.callbackNode = n));
  }
}
function Ba(e, t) {
  if (((Pr = -1), (zr = 0), R & 6)) throw Error(g(327));
  var n = e.callbackNode;
  if (Jt() && e.callbackNode !== n) return null;
  var r = Or(e, e === q ? ee : 0);
  if (r === 0) return null;
  if (r & 30 || r & e.expiredLanes || t) t = br(e, r);
  else {
    t = r;
    var l = R;
    R |= 2;
    var i = Wa();
    (q !== e || ee !== t) && ((Be = null), (ln = Q() + 500), Nt(e, t));
    do
      try {
        pd();
        break;
      } catch (u) {
        Va(e, u);
      }
    while (!0);
    (so(),
      (Zr.current = i),
      (R = l),
      Y !== null ? (t = 0) : ((q = null), (ee = 0), (t = G)));
  }
  if (t !== 0) {
    if (
      (t === 2 && ((l = si(e)), l !== 0 && ((r = l), (t = Di(e, l)))), t === 1)
    )
      throw ((n = Xn), Nt(e, 0), tt(e, r), he(e, Q()), n);
    if (t === 6) tt(e, r);
    else {
      if (
        ((l = e.current.alternate),
        !(r & 30) &&
          !fd(l) &&
          ((t = br(e, r)),
          t === 2 && ((i = si(e)), i !== 0 && ((r = i), (t = Di(e, i)))),
          t === 1))
      )
        throw ((n = Xn), Nt(e, 0), tt(e, r), he(e, Q()), n);
      switch (((e.finishedWork = l), (e.finishedLanes = r), t)) {
        case 0:
        case 1:
          throw Error(g(345));
        case 2:
          kt(e, ce, Be);
          break;
        case 3:
          if (
            (tt(e, r), (r & 130023424) === r && ((t = No + 500 - Q()), 10 < t))
          ) {
            if (Or(e, 0) !== 0) break;
            if (((l = e.suspendedLanes), (l & r) !== r)) {
              (ue(), (e.pingedLanes |= e.suspendedLanes & l));
              break;
            }
            e.timeoutHandle = vi(kt.bind(null, e, ce, Be), t);
            break;
          }
          kt(e, ce, Be);
          break;
        case 4:
          if ((tt(e, r), (r & 4194240) === r)) break;
          for (t = e.eventTimes, l = -1; 0 < r; ) {
            var o = 31 - Re(r);
            ((i = 1 << o), (o = t[o]), o > l && (l = o), (r &= ~i));
          }
          if (
            ((r = l),
            (r = Q() - r),
            (r =
              (120 > r
                ? 120
                : 480 > r
                  ? 480
                  : 1080 > r
                    ? 1080
                    : 1920 > r
                      ? 1920
                      : 3e3 > r
                        ? 3e3
                        : 4320 > r
                          ? 4320
                          : 1960 * cd(r / 1960)) - r),
            10 < r)
          ) {
            e.timeoutHandle = vi(kt.bind(null, e, ce, Be), r);
            break;
          }
          kt(e, ce, Be);
          break;
        case 5:
          kt(e, ce, Be);
          break;
        default:
          throw Error(g(329));
      }
    }
  }
  return (he(e, Q()), e.callbackNode === n ? Ba.bind(null, e) : null);
}
function Di(e, t) {
  var n = Ln;
  return (
    e.current.memoizedState.isDehydrated && (Nt(e, t).flags |= 256),
    (e = br(e, t)),
    e !== 2 && ((t = ce), (ce = n), t !== null && Fi(t)),
    e
  );
}
function Fi(e) {
  ce === null ? (ce = e) : ce.push.apply(ce, e);
}
function fd(e) {
  for (var t = e; ; ) {
    if (t.flags & 16384) {
      var n = t.updateQueue;
      if (n !== null && ((n = n.stores), n !== null))
        for (var r = 0; r < n.length; r++) {
          var l = n[r],
            i = l.getSnapshot;
          l = l.value;
          try {
            if (!Ie(i(), l)) return !1;
          } catch {
            return !1;
          }
        }
    }
    if (((n = t.child), t.subtreeFlags & 16384 && n !== null))
      ((n.return = t), (t = n));
    else {
      if (t === e) break;
      for (; t.sibling === null; ) {
        if (t.return === null || t.return === e) return !0;
        t = t.return;
      }
      ((t.sibling.return = t.return), (t = t.sibling));
    }
  }
  return !0;
}
function tt(e, t) {
  for (
    t &= ~Eo,
      t &= ~cl,
      e.suspendedLanes |= t,
      e.pingedLanes &= ~t,
      e = e.expirationTimes;
    0 < t;
  ) {
    var n = 31 - Re(t),
      r = 1 << n;
    ((e[n] = -1), (t &= ~r));
  }
}
function Uu(e) {
  if (R & 6) throw Error(g(327));
  Jt();
  var t = Or(e, 0);
  if (!(t & 1)) return (he(e, Q()), null);
  var n = br(e, t);
  if (e.tag !== 0 && n === 2) {
    var r = si(e);
    r !== 0 && ((t = r), (n = Di(e, r)));
  }
  if (n === 1) throw ((n = Xn), Nt(e, 0), tt(e, t), he(e, Q()), n);
  if (n === 6) throw Error(g(345));
  return (
    (e.finishedWork = e.current.alternate),
    (e.finishedLanes = t),
    kt(e, ce, Be),
    he(e, Q()),
    null
  );
}
function Co(e, t) {
  var n = R;
  R |= 1;
  try {
    return e(t);
  } finally {
    ((R = n), R === 0 && ((ln = Q() + 500), ol && vt()));
  }
}
function Lt(e) {
  rt !== null && rt.tag === 0 && !(R & 6) && Jt();
  var t = R;
  R |= 1;
  var n = Ne.transition,
    r = I;
  try {
    if (((Ne.transition = null), (I = 1), e)) return e();
  } finally {
    ((I = r), (Ne.transition = n), (R = t), !(R & 6) && vt());
  }
}
function _o() {
  ((me = Qt.current), F(Qt));
}
function Nt(e, t) {
  ((e.finishedWork = null), (e.finishedLanes = 0));
  var n = e.timeoutHandle;
  if ((n !== -1 && ((e.timeoutHandle = -1), Bf(n)), Y !== null))
    for (n = Y.return; n !== null; ) {
      var r = n;
      switch ((io(r), r.tag)) {
        case 1:
          ((r = r.type.childContextTypes), r != null && $r());
          break;
        case 3:
          (nn(), F(de), F(ie), mo());
          break;
        case 5:
          ho(r);
          break;
        case 4:
          nn();
          break;
        case 13:
          F($);
          break;
        case 19:
          F($);
          break;
        case 10:
          ao(r.type._context);
          break;
        case 22:
        case 23:
          _o();
      }
      n = n.return;
    }
  if (
    ((q = e),
    (Y = e = ft(e.current, null)),
    (ee = me = t),
    (G = 0),
    (Xn = null),
    (Eo = cl = zt = 0),
    (ce = Ln = null),
    xt !== null)
  ) {
    for (t = 0; t < xt.length; t++)
      if (((n = xt[t]), (r = n.interleaved), r !== null)) {
        n.interleaved = null;
        var l = r.next,
          i = n.pending;
        if (i !== null) {
          var o = i.next;
          ((i.next = l), (r.next = o));
        }
        n.pending = r;
      }
    xt = null;
  }
  return e;
}
function Va(e, t) {
  do {
    var n = Y;
    try {
      if ((so(), (Cr.current = Gr), Xr)) {
        for (var r = B.memoizedState; r !== null; ) {
          var l = r.queue;
          (l !== null && (l.pending = null), (r = r.next));
        }
        Xr = !1;
      }
      if (
        ((Pt = 0),
        (J = X = B = null),
        (Pn = !1),
        (Qn = 0),
        (xo.current = null),
        n === null || n.return === null)
      ) {
        ((G = 1), (Xn = t), (Y = null));
        break;
      }
      e: {
        var i = e,
          o = n.return,
          u = n,
          s = t;
        if (
          ((t = ee),
          (u.flags |= 32768),
          s !== null && typeof s == 'object' && typeof s.then == 'function')
        ) {
          var c = s,
            v = u,
            m = v.tag;
          if (!(v.mode & 1) && (m === 0 || m === 11 || m === 15)) {
            var h = v.alternate;
            h
              ? ((v.updateQueue = h.updateQueue),
                (v.memoizedState = h.memoizedState),
                (v.lanes = h.lanes))
              : ((v.updateQueue = null), (v.memoizedState = null));
          }
          var S = Cu(o);
          if (S !== null) {
            ((S.flags &= -257),
              _u(S, o, u, i, t),
              S.mode & 1 && Nu(i, c, t),
              (t = S),
              (s = c));
            var w = t.updateQueue;
            if (w === null) {
              var x = new Set();
              (x.add(s), (t.updateQueue = x));
            } else w.add(s);
            break e;
          } else {
            if (!(t & 1)) {
              (Nu(i, c, t), jo());
              break e;
            }
            s = Error(g(426));
          }
        } else if (A && u.mode & 1) {
          var M = Cu(o);
          if (M !== null) {
            (!(M.flags & 65536) && (M.flags |= 256),
              _u(M, o, u, i, t),
              oo(rn(s, u)));
            break e;
          }
        }
        ((i = s = rn(s, u)),
          G !== 4 && (G = 2),
          Ln === null ? (Ln = [i]) : Ln.push(i),
          (i = o));
        do {
          switch (i.tag) {
            case 3:
              ((i.flags |= 65536), (t &= -t), (i.lanes |= t));
              var f = Ca(i, s, t);
              gu(i, f);
              break e;
            case 1:
              u = s;
              var a = i.type,
                d = i.stateNode;
              if (
                !(i.flags & 128) &&
                (typeof a.getDerivedStateFromError == 'function' ||
                  (d !== null &&
                    typeof d.componentDidCatch == 'function' &&
                    (at === null || !at.has(d))))
              ) {
                ((i.flags |= 65536), (t &= -t), (i.lanes |= t));
                var y = _a(i, u, t);
                gu(i, y);
                break e;
              }
          }
          i = i.return;
        } while (i !== null);
      }
      Qa(n);
    } catch (k) {
      ((t = k), Y === n && n !== null && (Y = n = n.return));
      continue;
    }
    break;
  } while (!0);
}
function Wa() {
  var e = Zr.current;
  return ((Zr.current = Gr), e === null ? Gr : e);
}
function jo() {
  ((G === 0 || G === 3 || G === 2) && (G = 4),
    q === null || (!(zt & 268435455) && !(cl & 268435455)) || tt(q, ee));
}
function br(e, t) {
  var n = R;
  R |= 2;
  var r = Wa();
  (q !== e || ee !== t) && ((Be = null), Nt(e, t));
  do
    try {
      dd();
      break;
    } catch (l) {
      Va(e, l);
    }
  while (!0);
  if ((so(), (R = n), (Zr.current = r), Y !== null)) throw Error(g(261));
  return ((q = null), (ee = 0), G);
}
function dd() {
  for (; Y !== null; ) Ha(Y);
}
function pd() {
  for (; Y !== null && !Fc(); ) Ha(Y);
}
function Ha(e) {
  var t = Ya(e.alternate, e, me);
  ((e.memoizedProps = e.pendingProps),
    t === null ? Qa(e) : (Y = t),
    (xo.current = null));
}
function Qa(e) {
  var t = e;
  do {
    var n = t.alternate;
    if (((e = t.return), t.flags & 32768)) {
      if (((n = od(n, t)), n !== null)) {
        ((n.flags &= 32767), (Y = n));
        return;
      }
      if (e !== null)
        ((e.flags |= 32768), (e.subtreeFlags = 0), (e.deletions = null));
      else {
        ((G = 6), (Y = null));
        return;
      }
    } else if (((n = id(n, t, me)), n !== null)) {
      Y = n;
      return;
    }
    if (((t = t.sibling), t !== null)) {
      Y = t;
      return;
    }
    Y = t = e;
  } while (t !== null);
  G === 0 && (G = 5);
}
function kt(e, t, n) {
  var r = I,
    l = Ne.transition;
  try {
    ((Ne.transition = null), (I = 1), hd(e, t, n, r));
  } finally {
    ((Ne.transition = l), (I = r));
  }
  return null;
}
function hd(e, t, n, r) {
  do Jt();
  while (rt !== null);
  if (R & 6) throw Error(g(327));
  n = e.finishedWork;
  var l = e.finishedLanes;
  if (n === null) return null;
  if (((e.finishedWork = null), (e.finishedLanes = 0), n === e.current))
    throw Error(g(177));
  ((e.callbackNode = null), (e.callbackPriority = 0));
  var i = n.lanes | n.childLanes;
  if (
    (Yc(e, i),
    e === q && ((Y = q = null), (ee = 0)),
    (!(n.subtreeFlags & 2064) && !(n.flags & 2064)) ||
      yr ||
      ((yr = !0),
      Xa(Ir, function () {
        return (Jt(), null);
      })),
    (i = (n.flags & 15990) !== 0),
    n.subtreeFlags & 15990 || i)
  ) {
    ((i = Ne.transition), (Ne.transition = null));
    var o = I;
    I = 1;
    var u = R;
    ((R |= 4),
      (xo.current = null),
      sd(e, n),
      Aa(n, e),
      If(hi),
      (Dr = !!pi),
      (hi = pi = null),
      (e.current = n),
      ad(n),
      Uc(),
      (R = u),
      (I = o),
      (Ne.transition = i));
  } else e.current = n;
  if (
    (yr && ((yr = !1), (rt = e), (qr = l)),
    (i = e.pendingLanes),
    i === 0 && (at = null),
    Bc(n.stateNode),
    he(e, Q()),
    t !== null)
  )
    for (r = e.onRecoverableError, n = 0; n < t.length; n++)
      ((l = t[n]), r(l.value, { componentStack: l.stack, digest: l.digest }));
  if (Jr) throw ((Jr = !1), (e = Ii), (Ii = null), e);
  return (
    qr & 1 && e.tag !== 0 && Jt(),
    (i = e.pendingLanes),
    i & 1 ? (e === Oi ? Tn++ : ((Tn = 0), (Oi = e))) : (Tn = 0),
    vt(),
    null
  );
}
function Jt() {
  if (rt !== null) {
    var e = Cs(qr),
      t = Ne.transition,
      n = I;
    try {
      if (((Ne.transition = null), (I = 16 > e ? 16 : e), rt === null))
        var r = !1;
      else {
        if (((e = rt), (rt = null), (qr = 0), R & 6)) throw Error(g(331));
        var l = R;
        for (R |= 4, N = e.current; N !== null; ) {
          var i = N,
            o = i.child;
          if (N.flags & 16) {
            var u = i.deletions;
            if (u !== null) {
              for (var s = 0; s < u.length; s++) {
                var c = u[s];
                for (N = c; N !== null; ) {
                  var v = N;
                  switch (v.tag) {
                    case 0:
                    case 11:
                    case 15:
                      zn(8, v, i);
                  }
                  var m = v.child;
                  if (m !== null) ((m.return = v), (N = m));
                  else
                    for (; N !== null; ) {
                      v = N;
                      var h = v.sibling,
                        S = v.return;
                      if ((Da(v), v === c)) {
                        N = null;
                        break;
                      }
                      if (h !== null) {
                        ((h.return = S), (N = h));
                        break;
                      }
                      N = S;
                    }
                }
              }
              var w = i.alternate;
              if (w !== null) {
                var x = w.child;
                if (x !== null) {
                  w.child = null;
                  do {
                    var M = x.sibling;
                    ((x.sibling = null), (x = M));
                  } while (x !== null);
                }
              }
              N = i;
            }
          }
          if (i.subtreeFlags & 2064 && o !== null) ((o.return = i), (N = o));
          else
            e: for (; N !== null; ) {
              if (((i = N), i.flags & 2048))
                switch (i.tag) {
                  case 0:
                  case 11:
                  case 15:
                    zn(9, i, i.return);
                }
              var f = i.sibling;
              if (f !== null) {
                ((f.return = i.return), (N = f));
                break e;
              }
              N = i.return;
            }
        }
        var a = e.current;
        for (N = a; N !== null; ) {
          o = N;
          var d = o.child;
          if (o.subtreeFlags & 2064 && d !== null) ((d.return = o), (N = d));
          else
            e: for (o = a; N !== null; ) {
              if (((u = N), u.flags & 2048))
                try {
                  switch (u.tag) {
                    case 0:
                    case 11:
                    case 15:
                      al(9, u);
                  }
                } catch (k) {
                  W(u, u.return, k);
                }
              if (u === o) {
                N = null;
                break e;
              }
              var y = u.sibling;
              if (y !== null) {
                ((y.return = u.return), (N = y));
                break e;
              }
              N = u.return;
            }
        }
        if (
          ((R = l), vt(), Ae && typeof Ae.onPostCommitFiberRoot == 'function')
        )
          try {
            Ae.onPostCommitFiberRoot(tl, e);
          } catch {}
        r = !0;
      }
      return r;
    } finally {
      ((I = n), (Ne.transition = t));
    }
  }
  return !1;
}
function Au(e, t, n) {
  ((t = rn(n, t)),
    (t = Ca(e, t, 1)),
    (e = st(e, t, 1)),
    (t = ue()),
    e !== null && (Zn(e, 1, t), he(e, t)));
}
function W(e, t, n) {
  if (e.tag === 3) Au(e, e, n);
  else
    for (; t !== null; ) {
      if (t.tag === 3) {
        Au(t, e, n);
        break;
      } else if (t.tag === 1) {
        var r = t.stateNode;
        if (
          typeof t.type.getDerivedStateFromError == 'function' ||
          (typeof r.componentDidCatch == 'function' &&
            (at === null || !at.has(r)))
        ) {
          ((e = rn(n, e)),
            (e = _a(t, e, 1)),
            (t = st(t, e, 1)),
            (e = ue()),
            t !== null && (Zn(t, 1, e), he(t, e)));
          break;
        }
      }
      t = t.return;
    }
}
function md(e, t, n) {
  var r = e.pingCache;
  (r !== null && r.delete(t),
    (t = ue()),
    (e.pingedLanes |= e.suspendedLanes & n),
    q === e &&
      (ee & n) === n &&
      (G === 4 || (G === 3 && (ee & 130023424) === ee && 500 > Q() - No)
        ? Nt(e, 0)
        : (Eo |= n)),
    he(e, t));
}
function Ka(e, t) {
  t === 0 &&
    (e.mode & 1
      ? ((t = ur), (ur <<= 1), !(ur & 130023424) && (ur = 4194304))
      : (t = 1));
  var n = ue();
  ((e = Xe(e, t)), e !== null && (Zn(e, t, n), he(e, n)));
}
function vd(e) {
  var t = e.memoizedState,
    n = 0;
  (t !== null && (n = t.retryLane), Ka(e, n));
}
function yd(e, t) {
  var n = 0;
  switch (e.tag) {
    case 13:
      var r = e.stateNode,
        l = e.memoizedState;
      l !== null && (n = l.retryLane);
      break;
    case 19:
      r = e.stateNode;
      break;
    default:
      throw Error(g(314));
  }
  (r !== null && r.delete(t), Ka(e, n));
}
var Ya;
Ya = function (e, t, n) {
  if (e !== null)
    if (e.memoizedProps !== t.pendingProps || de.current) fe = !0;
    else {
      if (!(e.lanes & n) && !(t.flags & 128)) return ((fe = !1), ld(e, t, n));
      fe = !!(e.flags & 131072);
    }
  else ((fe = !1), A && t.flags & 1048576 && Js(t, Wr, t.index));
  switch (((t.lanes = 0), t.tag)) {
    case 2:
      var r = t.type;
      (jr(e, t), (e = t.pendingProps));
      var l = bt(t, ie.current);
      (Zt(t, n), (l = yo(null, t, r, e, l, n)));
      var i = go();
      return (
        (t.flags |= 1),
        typeof l == 'object' &&
        l !== null &&
        typeof l.render == 'function' &&
        l.$$typeof === void 0
          ? ((t.tag = 1),
            (t.memoizedState = null),
            (t.updateQueue = null),
            pe(r) ? ((i = !0), Br(t)) : (i = !1),
            (t.memoizedState =
              l.state !== null && l.state !== void 0 ? l.state : null),
            fo(t),
            (l.updater = sl),
            (t.stateNode = l),
            (l._reactInternals = t),
            Ei(t, r, e, n),
            (t = _i(null, t, r, !0, i, n)))
          : ((t.tag = 0), A && i && lo(t), oe(null, t, l, n), (t = t.child)),
        t
      );
    case 16:
      r = t.elementType;
      e: {
        switch (
          (jr(e, t),
          (e = t.pendingProps),
          (l = r._init),
          (r = l(r._payload)),
          (t.type = r),
          (l = t.tag = wd(r)),
          (e = ze(r, e)),
          l)
        ) {
          case 0:
            t = Ci(null, t, r, e, n);
            break e;
          case 1:
            t = zu(null, t, r, e, n);
            break e;
          case 11:
            t = ju(null, t, r, e, n);
            break e;
          case 14:
            t = Pu(null, t, r, ze(r.type, e), n);
            break e;
        }
        throw Error(g(306, r, ''));
      }
      return t;
    case 0:
      return (
        (r = t.type),
        (l = t.pendingProps),
        (l = t.elementType === r ? l : ze(r, l)),
        Ci(e, t, r, l, n)
      );
    case 1:
      return (
        (r = t.type),
        (l = t.pendingProps),
        (l = t.elementType === r ? l : ze(r, l)),
        zu(e, t, r, l, n)
      );
    case 3:
      e: {
        if ((La(t), e === null)) throw Error(g(387));
        ((r = t.pendingProps),
          (i = t.memoizedState),
          (l = i.element),
          ra(e, t),
          Kr(t, r, null, n));
        var o = t.memoizedState;
        if (((r = o.element), i.isDehydrated))
          if (
            ((i = {
              element: r,
              isDehydrated: !1,
              cache: o.cache,
              pendingSuspenseBoundaries: o.pendingSuspenseBoundaries,
              transitions: o.transitions,
            }),
            (t.updateQueue.baseState = i),
            (t.memoizedState = i),
            t.flags & 256)
          ) {
            ((l = rn(Error(g(423)), t)), (t = Lu(e, t, r, n, l)));
            break e;
          } else if (r !== l) {
            ((l = rn(Error(g(424)), t)), (t = Lu(e, t, r, n, l)));
            break e;
          } else
            for (
              ve = ut(t.stateNode.containerInfo.firstChild),
                ye = t,
                A = !0,
                Te = null,
                n = ta(t, null, r, n),
                t.child = n;
              n;
            )
              ((n.flags = (n.flags & -3) | 4096), (n = n.sibling));
        else {
          if ((en(), r === l)) {
            t = Ge(e, t, n);
            break e;
          }
          oe(e, t, r, n);
        }
        t = t.child;
      }
      return t;
    case 5:
      return (
        la(t),
        e === null && ki(t),
        (r = t.type),
        (l = t.pendingProps),
        (i = e !== null ? e.memoizedProps : null),
        (o = l.children),
        mi(r, l) ? (o = null) : i !== null && mi(r, i) && (t.flags |= 32),
        za(e, t),
        oe(e, t, o, n),
        t.child
      );
    case 6:
      return (e === null && ki(t), null);
    case 13:
      return Ta(e, t, n);
    case 4:
      return (
        po(t, t.stateNode.containerInfo),
        (r = t.pendingProps),
        e === null ? (t.child = tn(t, null, r, n)) : oe(e, t, r, n),
        t.child
      );
    case 11:
      return (
        (r = t.type),
        (l = t.pendingProps),
        (l = t.elementType === r ? l : ze(r, l)),
        ju(e, t, r, l, n)
      );
    case 7:
      return (oe(e, t, t.pendingProps, n), t.child);
    case 8:
      return (oe(e, t, t.pendingProps.children, n), t.child);
    case 12:
      return (oe(e, t, t.pendingProps.children, n), t.child);
    case 10:
      e: {
        if (
          ((r = t.type._context),
          (l = t.pendingProps),
          (i = t.memoizedProps),
          (o = l.value),
          O(Hr, r._currentValue),
          (r._currentValue = o),
          i !== null)
        )
          if (Ie(i.value, o)) {
            if (i.children === l.children && !de.current) {
              t = Ge(e, t, n);
              break e;
            }
          } else
            for (i = t.child, i !== null && (i.return = t); i !== null; ) {
              var u = i.dependencies;
              if (u !== null) {
                o = i.child;
                for (var s = u.firstContext; s !== null; ) {
                  if (s.context === r) {
                    if (i.tag === 1) {
                      ((s = Qe(-1, n & -n)), (s.tag = 2));
                      var c = i.updateQueue;
                      if (c !== null) {
                        c = c.shared;
                        var v = c.pending;
                        (v === null
                          ? (s.next = s)
                          : ((s.next = v.next), (v.next = s)),
                          (c.pending = s));
                      }
                    }
                    ((i.lanes |= n),
                      (s = i.alternate),
                      s !== null && (s.lanes |= n),
                      Si(i.return, n, t),
                      (u.lanes |= n));
                    break;
                  }
                  s = s.next;
                }
              } else if (i.tag === 10) o = i.type === t.type ? null : i.child;
              else if (i.tag === 18) {
                if (((o = i.return), o === null)) throw Error(g(341));
                ((o.lanes |= n),
                  (u = o.alternate),
                  u !== null && (u.lanes |= n),
                  Si(o, n, t),
                  (o = i.sibling));
              } else o = i.child;
              if (o !== null) o.return = i;
              else
                for (o = i; o !== null; ) {
                  if (o === t) {
                    o = null;
                    break;
                  }
                  if (((i = o.sibling), i !== null)) {
                    ((i.return = o.return), (o = i));
                    break;
                  }
                  o = o.return;
                }
              i = o;
            }
        (oe(e, t, l.children, n), (t = t.child));
      }
      return t;
    case 9:
      return (
        (l = t.type),
        (r = t.pendingProps.children),
        Zt(t, n),
        (l = Ce(l)),
        (r = r(l)),
        (t.flags |= 1),
        oe(e, t, r, n),
        t.child
      );
    case 14:
      return (
        (r = t.type),
        (l = ze(r, t.pendingProps)),
        (l = ze(r.type, l)),
        Pu(e, t, r, l, n)
      );
    case 15:
      return ja(e, t, t.type, t.pendingProps, n);
    case 17:
      return (
        (r = t.type),
        (l = t.pendingProps),
        (l = t.elementType === r ? l : ze(r, l)),
        jr(e, t),
        (t.tag = 1),
        pe(r) ? ((e = !0), Br(t)) : (e = !1),
        Zt(t, n),
        Na(t, r, l),
        Ei(t, r, l, n),
        _i(null, t, r, !0, e, n)
      );
    case 19:
      return Ra(e, t, n);
    case 22:
      return Pa(e, t, n);
  }
  throw Error(g(156, t.tag));
};
function Xa(e, t) {
  return Ss(e, t);
}
function gd(e, t, n, r) {
  ((this.tag = e),
    (this.key = n),
    (this.sibling =
      this.child =
      this.return =
      this.stateNode =
      this.type =
      this.elementType =
        null),
    (this.index = 0),
    (this.ref = null),
    (this.pendingProps = t),
    (this.dependencies =
      this.memoizedState =
      this.updateQueue =
      this.memoizedProps =
        null),
    (this.mode = r),
    (this.subtreeFlags = this.flags = 0),
    (this.deletions = null),
    (this.childLanes = this.lanes = 0),
    (this.alternate = null));
}
function Ee(e, t, n, r) {
  return new gd(e, t, n, r);
}
function Po(e) {
  return ((e = e.prototype), !(!e || !e.isReactComponent));
}
function wd(e) {
  if (typeof e == 'function') return Po(e) ? 1 : 0;
  if (e != null) {
    if (((e = e.$$typeof), e === Ki)) return 11;
    if (e === Yi) return 14;
  }
  return 2;
}
function ft(e, t) {
  var n = e.alternate;
  return (
    n === null
      ? ((n = Ee(e.tag, t, e.key, e.mode)),
        (n.elementType = e.elementType),
        (n.type = e.type),
        (n.stateNode = e.stateNode),
        (n.alternate = e),
        (e.alternate = n))
      : ((n.pendingProps = t),
        (n.type = e.type),
        (n.flags = 0),
        (n.subtreeFlags = 0),
        (n.deletions = null)),
    (n.flags = e.flags & 14680064),
    (n.childLanes = e.childLanes),
    (n.lanes = e.lanes),
    (n.child = e.child),
    (n.memoizedProps = e.memoizedProps),
    (n.memoizedState = e.memoizedState),
    (n.updateQueue = e.updateQueue),
    (t = e.dependencies),
    (n.dependencies =
      t === null ? null : { lanes: t.lanes, firstContext: t.firstContext }),
    (n.sibling = e.sibling),
    (n.index = e.index),
    (n.ref = e.ref),
    n
  );
}
function Lr(e, t, n, r, l, i) {
  var o = 2;
  if (((r = e), typeof e == 'function')) Po(e) && (o = 1);
  else if (typeof e == 'string') o = 5;
  else
    e: switch (e) {
      case Ot:
        return Ct(n.children, l, i, t);
      case Qi:
        ((o = 8), (l |= 8));
        break;
      case Yl:
        return (
          (e = Ee(12, n, t, l | 2)),
          (e.elementType = Yl),
          (e.lanes = i),
          e
        );
      case Xl:
        return ((e = Ee(13, n, t, l)), (e.elementType = Xl), (e.lanes = i), e);
      case Gl:
        return ((e = Ee(19, n, t, l)), (e.elementType = Gl), (e.lanes = i), e);
      case ls:
        return fl(n, l, i, t);
      default:
        if (typeof e == 'object' && e !== null)
          switch (e.$$typeof) {
            case ns:
              o = 10;
              break e;
            case rs:
              o = 9;
              break e;
            case Ki:
              o = 11;
              break e;
            case Yi:
              o = 14;
              break e;
            case qe:
              ((o = 16), (r = null));
              break e;
          }
        throw Error(g(130, e == null ? e : typeof e, ''));
    }
  return (
    (t = Ee(o, n, t, l)),
    (t.elementType = e),
    (t.type = r),
    (t.lanes = i),
    t
  );
}
function Ct(e, t, n, r) {
  return ((e = Ee(7, e, r, t)), (e.lanes = n), e);
}
function fl(e, t, n, r) {
  return (
    (e = Ee(22, e, r, t)),
    (e.elementType = ls),
    (e.lanes = n),
    (e.stateNode = { isHidden: !1 }),
    e
  );
}
function Hl(e, t, n) {
  return ((e = Ee(6, e, null, t)), (e.lanes = n), e);
}
function Ql(e, t, n) {
  return (
    (t = Ee(4, e.children !== null ? e.children : [], e.key, t)),
    (t.lanes = n),
    (t.stateNode = {
      containerInfo: e.containerInfo,
      pendingChildren: null,
      implementation: e.implementation,
    }),
    t
  );
}
function kd(e, t, n, r, l) {
  ((this.tag = t),
    (this.containerInfo = e),
    (this.finishedWork =
      this.pingCache =
      this.current =
      this.pendingChildren =
        null),
    (this.timeoutHandle = -1),
    (this.callbackNode = this.pendingContext = this.context = null),
    (this.callbackPriority = 0),
    (this.eventTimes = Cl(0)),
    (this.expirationTimes = Cl(-1)),
    (this.entangledLanes =
      this.finishedLanes =
      this.mutableReadLanes =
      this.expiredLanes =
      this.pingedLanes =
      this.suspendedLanes =
      this.pendingLanes =
        0),
    (this.entanglements = Cl(0)),
    (this.identifierPrefix = r),
    (this.onRecoverableError = l),
    (this.mutableSourceEagerHydrationData = null));
}
function zo(e, t, n, r, l, i, o, u, s) {
  return (
    (e = new kd(e, t, n, u, s)),
    t === 1 ? ((t = 1), i === !0 && (t |= 8)) : (t = 0),
    (i = Ee(3, null, null, t)),
    (e.current = i),
    (i.stateNode = e),
    (i.memoizedState = {
      element: r,
      isDehydrated: n,
      cache: null,
      transitions: null,
      pendingSuspenseBoundaries: null,
    }),
    fo(i),
    e
  );
}
function Sd(e, t, n) {
  var r = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
  return {
    $$typeof: It,
    key: r == null ? null : '' + r,
    children: e,
    containerInfo: t,
    implementation: n,
  };
}
function Ga(e) {
  if (!e) return pt;
  e = e._reactInternals;
  e: {
    if (Rt(e) !== e || e.tag !== 1) throw Error(g(170));
    var t = e;
    do {
      switch (t.tag) {
        case 3:
          t = t.stateNode.context;
          break e;
        case 1:
          if (pe(t.type)) {
            t = t.stateNode.__reactInternalMemoizedMergedChildContext;
            break e;
          }
      }
      t = t.return;
    } while (t !== null);
    throw Error(g(171));
  }
  if (e.tag === 1) {
    var n = e.type;
    if (pe(n)) return Gs(e, n, t);
  }
  return t;
}
function Za(e, t, n, r, l, i, o, u, s) {
  return (
    (e = zo(n, r, !0, e, l, i, o, u, s)),
    (e.context = Ga(null)),
    (n = e.current),
    (r = ue()),
    (l = ct(n)),
    (i = Qe(r, l)),
    (i.callback = t ?? null),
    st(n, i, l),
    (e.current.lanes = l),
    Zn(e, l, r),
    he(e, r),
    e
  );
}
function dl(e, t, n, r) {
  var l = t.current,
    i = ue(),
    o = ct(l);
  return (
    (n = Ga(n)),
    t.context === null ? (t.context = n) : (t.pendingContext = n),
    (t = Qe(i, o)),
    (t.payload = { element: e }),
    (r = r === void 0 ? null : r),
    r !== null && (t.callback = r),
    (e = st(l, t, o)),
    e !== null && (Me(e, l, o, i), Nr(e, l, o)),
    o
  );
}
function el(e) {
  if (((e = e.current), !e.child)) return null;
  switch (e.child.tag) {
    case 5:
      return e.child.stateNode;
    default:
      return e.child.stateNode;
  }
}
function $u(e, t) {
  if (((e = e.memoizedState), e !== null && e.dehydrated !== null)) {
    var n = e.retryLane;
    e.retryLane = n !== 0 && n < t ? n : t;
  }
}
function Lo(e, t) {
  ($u(e, t), (e = e.alternate) && $u(e, t));
}
function xd() {
  return null;
}
var Ja =
  typeof reportError == 'function'
    ? reportError
    : function (e) {
        console.error(e);
      };
function To(e) {
  this._internalRoot = e;
}
pl.prototype.render = To.prototype.render = function (e) {
  var t = this._internalRoot;
  if (t === null) throw Error(g(409));
  dl(e, t, null, null);
};
pl.prototype.unmount = To.prototype.unmount = function () {
  var e = this._internalRoot;
  if (e !== null) {
    this._internalRoot = null;
    var t = e.containerInfo;
    (Lt(function () {
      dl(null, e, null, null);
    }),
      (t[Ye] = null));
  }
};
function pl(e) {
  this._internalRoot = e;
}
pl.prototype.unstable_scheduleHydration = function (e) {
  if (e) {
    var t = Ps();
    e = { blockedOn: null, target: e, priority: t };
    for (var n = 0; n < et.length && t !== 0 && t < et[n].priority; n++);
    (et.splice(n, 0, e), n === 0 && Ls(e));
  }
};
function Ro(e) {
  return !(!e || (e.nodeType !== 1 && e.nodeType !== 9 && e.nodeType !== 11));
}
function hl(e) {
  return !(
    !e ||
    (e.nodeType !== 1 &&
      e.nodeType !== 9 &&
      e.nodeType !== 11 &&
      (e.nodeType !== 8 || e.nodeValue !== ' react-mount-point-unstable '))
  );
}
function Bu() {}
function Ed(e, t, n, r, l) {
  if (l) {
    if (typeof r == 'function') {
      var i = r;
      r = function () {
        var c = el(o);
        i.call(c);
      };
    }
    var o = Za(t, r, e, 0, null, !1, !1, '', Bu);
    return (
      (e._reactRootContainer = o),
      (e[Ye] = o.current),
      $n(e.nodeType === 8 ? e.parentNode : e),
      Lt(),
      o
    );
  }
  for (; (l = e.lastChild); ) e.removeChild(l);
  if (typeof r == 'function') {
    var u = r;
    r = function () {
      var c = el(s);
      u.call(c);
    };
  }
  var s = zo(e, 0, !1, null, null, !1, !1, '', Bu);
  return (
    (e._reactRootContainer = s),
    (e[Ye] = s.current),
    $n(e.nodeType === 8 ? e.parentNode : e),
    Lt(function () {
      dl(t, s, n, r);
    }),
    s
  );
}
function ml(e, t, n, r, l) {
  var i = n._reactRootContainer;
  if (i) {
    var o = i;
    if (typeof l == 'function') {
      var u = l;
      l = function () {
        var s = el(o);
        u.call(s);
      };
    }
    dl(t, o, e, l);
  } else o = Ed(n, t, e, l, r);
  return el(o);
}
_s = function (e) {
  switch (e.tag) {
    case 3:
      var t = e.stateNode;
      if (t.current.memoizedState.isDehydrated) {
        var n = Sn(t.pendingLanes);
        n !== 0 &&
          (Zi(t, n | 1), he(t, Q()), !(R & 6) && ((ln = Q() + 500), vt()));
      }
      break;
    case 13:
      (Lt(function () {
        var r = Xe(e, 1);
        if (r !== null) {
          var l = ue();
          Me(r, e, 1, l);
        }
      }),
        Lo(e, 1));
  }
};
Ji = function (e) {
  if (e.tag === 13) {
    var t = Xe(e, 134217728);
    if (t !== null) {
      var n = ue();
      Me(t, e, 134217728, n);
    }
    Lo(e, 134217728);
  }
};
js = function (e) {
  if (e.tag === 13) {
    var t = ct(e),
      n = Xe(e, t);
    if (n !== null) {
      var r = ue();
      Me(n, e, t, r);
    }
    Lo(e, t);
  }
};
Ps = function () {
  return I;
};
zs = function (e, t) {
  var n = I;
  try {
    return ((I = e), t());
  } finally {
    I = n;
  }
};
ii = function (e, t, n) {
  switch (t) {
    case 'input':
      if ((ql(e, n), (t = n.name), n.type === 'radio' && t != null)) {
        for (n = e; n.parentNode; ) n = n.parentNode;
        for (
          n = n.querySelectorAll(
            'input[name=' + JSON.stringify('' + t) + '][type="radio"]',
          ),
            t = 0;
          t < n.length;
          t++
        ) {
          var r = n[t];
          if (r !== e && r.form === e.form) {
            var l = il(r);
            if (!l) throw Error(g(90));
            (os(r), ql(r, l));
          }
        }
      }
      break;
    case 'textarea':
      ss(e, n);
      break;
    case 'select':
      ((t = n.value), t != null && Kt(e, !!n.multiple, t, !1));
  }
};
ms = Co;
vs = Lt;
var Nd = { usingClientEntryPoint: !1, Events: [qn, At, il, ps, hs, Co] },
  gn = {
    findFiberByHostInstance: St,
    bundleType: 0,
    version: '18.3.1',
    rendererPackageName: 'react-dom',
  },
  Cd = {
    bundleType: gn.bundleType,
    version: gn.version,
    rendererPackageName: gn.rendererPackageName,
    rendererConfig: gn.rendererConfig,
    overrideHookState: null,
    overrideHookStateDeletePath: null,
    overrideHookStateRenamePath: null,
    overrideProps: null,
    overridePropsDeletePath: null,
    overridePropsRenamePath: null,
    setErrorHandler: null,
    setSuspenseHandler: null,
    scheduleUpdate: null,
    currentDispatcherRef: Ze.ReactCurrentDispatcher,
    findHostInstanceByFiber: function (e) {
      return ((e = ws(e)), e === null ? null : e.stateNode);
    },
    findFiberByHostInstance: gn.findFiberByHostInstance || xd,
    findHostInstancesForRefresh: null,
    scheduleRefresh: null,
    scheduleRoot: null,
    setRefreshHandler: null,
    getCurrentFiber: null,
    reconcilerVersion: '18.3.1-next-f1338f8080-20240426',
  };
if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < 'u') {
  var gr = __REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!gr.isDisabled && gr.supportsFiber)
    try {
      ((tl = gr.inject(Cd)), (Ae = gr));
    } catch {}
}
we.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = Nd;
we.createPortal = function (e, t) {
  var n = 2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : null;
  if (!Ro(t)) throw Error(g(200));
  return Sd(e, t, null, n);
};
we.createRoot = function (e, t) {
  if (!Ro(e)) throw Error(g(299));
  var n = !1,
    r = '',
    l = Ja;
  return (
    t != null &&
      (t.unstable_strictMode === !0 && (n = !0),
      t.identifierPrefix !== void 0 && (r = t.identifierPrefix),
      t.onRecoverableError !== void 0 && (l = t.onRecoverableError)),
    (t = zo(e, 1, !1, null, null, n, !1, r, l)),
    (e[Ye] = t.current),
    $n(e.nodeType === 8 ? e.parentNode : e),
    new To(t)
  );
};
we.findDOMNode = function (e) {
  if (e == null) return null;
  if (e.nodeType === 1) return e;
  var t = e._reactInternals;
  if (t === void 0)
    throw typeof e.render == 'function'
      ? Error(g(188))
      : ((e = Object.keys(e).join(',')), Error(g(268, e)));
  return ((e = ws(t)), (e = e === null ? null : e.stateNode), e);
};
we.flushSync = function (e) {
  return Lt(e);
};
we.hydrate = function (e, t, n) {
  if (!hl(t)) throw Error(g(200));
  return ml(null, e, t, !0, n);
};
we.hydrateRoot = function (e, t, n) {
  if (!Ro(e)) throw Error(g(405));
  var r = (n != null && n.hydratedSources) || null,
    l = !1,
    i = '',
    o = Ja;
  if (
    (n != null &&
      (n.unstable_strictMode === !0 && (l = !0),
      n.identifierPrefix !== void 0 && (i = n.identifierPrefix),
      n.onRecoverableError !== void 0 && (o = n.onRecoverableError)),
    (t = Za(t, null, e, 1, n ?? null, l, !1, i, o)),
    (e[Ye] = t.current),
    $n(e),
    r)
  )
    for (e = 0; e < r.length; e++)
      ((n = r[e]),
        (l = n._getVersion),
        (l = l(n._source)),
        t.mutableSourceEagerHydrationData == null
          ? (t.mutableSourceEagerHydrationData = [n, l])
          : t.mutableSourceEagerHydrationData.push(n, l));
  return new pl(t);
};
we.render = function (e, t, n) {
  if (!hl(t)) throw Error(g(200));
  return ml(null, e, t, !1, n);
};
we.unmountComponentAtNode = function (e) {
  if (!hl(e)) throw Error(g(40));
  return e._reactRootContainer
    ? (Lt(function () {
        ml(null, null, e, !1, function () {
          ((e._reactRootContainer = null), (e[Ye] = null));
        });
      }),
      !0)
    : !1;
};
we.unstable_batchedUpdates = Co;
we.unstable_renderSubtreeIntoContainer = function (e, t, n, r) {
  if (!hl(n)) throw Error(g(200));
  if (e == null || e._reactInternals === void 0) throw Error(g(38));
  return ml(e, t, n, !1, r);
};
we.version = '18.3.1-next-f1338f8080-20240426';
function qa() {
  if (
    !(
      typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > 'u' ||
      typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != 'function'
    )
  )
    try {
      __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(qa);
    } catch (e) {
      console.error(e);
    }
}
(qa(), (qu.exports = we));
var _d = qu.exports,
  ba,
  Vu = _d;
((ba = Vu.createRoot), Vu.hydrateRoot);
var ec = { exports: {} },
  vl = {};
/**
 * @license React
 * react-jsx-runtime.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */ var jd = K,
  Pd = Symbol.for('react.element'),
  zd = Symbol.for('react.fragment'),
  Ld = Object.prototype.hasOwnProperty,
  Td = jd.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner,
  Rd = { key: !0, ref: !0, __self: !0, __source: !0 };
function tc(e, t, n) {
  var r,
    l = {},
    i = null,
    o = null;
  (n !== void 0 && (i = '' + n),
    t.key !== void 0 && (i = '' + t.key),
    t.ref !== void 0 && (o = t.ref));
  for (r in t) Ld.call(t, r) && !Rd.hasOwnProperty(r) && (l[r] = t[r]);
  if (e && e.defaultProps)
    for (r in ((t = e.defaultProps), t)) l[r] === void 0 && (l[r] = t[r]);
  return {
    $$typeof: Pd,
    type: e,
    key: i,
    ref: o,
    props: l,
    _owner: Td.current,
  };
}
vl.Fragment = zd;
vl.jsx = tc;
vl.jsxs = tc;
ec.exports = vl;
var p = ec.exports;
function Md({ tracks: e, onSelectLesson: t }) {
  return p.jsxs('div', {
    className: 'curriculum-browser',
    children: [
      p.jsxs('header', {
        className: 'curriculum-header',
        children: [
          p.jsxs('div', {
            className: 'curriculum-logo',
            children: [
              p.jsx('span', { className: 'logo-accent', children: 'A' }),
              'nnealMusic ',
              p.jsx('span', { className: 'logo-badge', children: 'Academy' }),
            ],
          }),
          p.jsx('h1', {
            className: 'curriculum-title',
            children: 'Pedagogical Tracks',
          }),
          p.jsx('p', {
            className: 'curriculum-subtitle',
            children:
              'Master the physics of phase coupling, microtonal tuning, and emergent synthesis through interactive, self-paced sonic explorations.',
          }),
        ],
      }),
      p.jsx('main', {
        className: 'curriculum-content',
        children: p.jsx('div', {
          className: 'tracks-grid',
          children: e.map((n) => {
            const r = n.color || '#6366f1';
            return p.jsxs(
              'section',
              {
                className: 'track-card',
                style: { '--track-accent': r },
                children: [
                  p.jsx('div', { className: 'track-glow' }),
                  p.jsxs('div', {
                    className: 'track-header',
                    children: [
                      p.jsxs('div', {
                        className: 'track-pillar-badge',
                        children: ['PILLAR ', n.position + 1],
                      }),
                      p.jsx('h2', {
                        className: 'track-title',
                        children: n.title,
                      }),
                      p.jsx('p', {
                        className: 'track-description',
                        children: n.description,
                      }),
                    ],
                  }),
                  p.jsx('div', {
                    className: 'lessons-list',
                    children:
                      n.lessons.length === 0
                        ? p.jsx('div', {
                            className: 'no-lessons',
                            children:
                              'No lessons registered under this pillar.',
                          })
                        : n.lessons.map((l) =>
                            p.jsxs(
                              'div',
                              {
                                className: 'lesson-row',
                                onClick: () => t(n.slug, l.slug),
                                role: 'button',
                                tabIndex: 0,
                                onKeyDown: (i) => {
                                  (i.key === 'Enter' || i.key === ' ') &&
                                    t(n.slug, l.slug);
                                },
                                children: [
                                  p.jsxs('div', {
                                    className: 'lesson-info',
                                    children: [
                                      p.jsx('h3', {
                                        className: 'lesson-title',
                                        children: l.title,
                                      }),
                                      p.jsx('p', {
                                        className: 'lesson-desc',
                                        children: l.description,
                                      }),
                                      p.jsxs('div', {
                                        className: 'lesson-meta',
                                        children: [
                                          p.jsx('span', {
                                            className: `difficulty-badge difficulty-${l.difficulty}`,
                                            children: l.difficulty,
                                          }),
                                          p.jsxs('span', {
                                            className: 'duration-badge',
                                            children: [
                                              p.jsxs('svg', {
                                                viewBox: '0 0 24 24',
                                                width: '12',
                                                height: '12',
                                                fill: 'none',
                                                stroke: 'currentColor',
                                                strokeWidth: '2',
                                                style: {
                                                  marginRight: '4px',
                                                  verticalAlign: 'middle',
                                                },
                                                children: [
                                                  p.jsx('circle', {
                                                    cx: '12',
                                                    cy: '12',
                                                    r: '10',
                                                  }),
                                                  p.jsx('polyline', {
                                                    points: '12 6 12 12 16 14',
                                                  }),
                                                ],
                                              }),
                                              l.estimated_minutes,
                                              ' min',
                                            ],
                                          }),
                                        ],
                                      }),
                                    ],
                                  }),
                                  p.jsx('div', {
                                    className: 'lesson-action',
                                    children: p.jsx('span', {
                                      className: 'start-lesson-icon',
                                      children: p.jsx('svg', {
                                        viewBox: '0 0 24 24',
                                        width: '16',
                                        height: '16',
                                        fill: 'none',
                                        stroke: 'currentColor',
                                        strokeWidth: '2.5',
                                        strokeLinecap: 'round',
                                        strokeLinejoin: 'round',
                                        children: p.jsx('polygon', {
                                          points: '5 3 19 12 5 21 5 3',
                                        }),
                                      }),
                                    }),
                                  }),
                                ],
                              },
                              l.id,
                            ),
                          ),
                  }),
                ],
              },
              n.id,
            );
          }),
        }),
      }),
    ],
  });
}
function Id({ step: e, onComplete: t }) {
  const { title: n, content: r, key_points: l } = e.config || {},
    i =
      typeof r == 'string'
        ? r
            .split(
              `

`,
            )
            .filter(Boolean)
        : [];
  return p.jsxs('div', {
    className: 'learn-step-content text-step animate-fade-in',
    children: [
      n && p.jsx('h2', { className: 'step-title', children: n }),
      p.jsx('div', {
        className: 'step-body-text',
        children: i.map((o, u) =>
          p.jsx('p', { className: 'step-paragraph', children: o }, u),
        ),
      }),
      l &&
        Array.isArray(l) &&
        l.length > 0 &&
        p.jsxs('div', {
          className: 'step-key-takeaways',
          children: [
            p.jsx('h4', {
              className: 'key-takeaways-title',
              children: 'Key takeaways:',
            }),
            p.jsx('ul', {
              className: 'key-takeaways-list',
              children: l.map((o, u) =>
                p.jsxs(
                  'li',
                  {
                    className: 'key-takeaway-item',
                    children: [
                      p.jsx('span', {
                        className: 'takeaway-bullet',
                        children: '•',
                      }),
                      p.jsx('span', {
                        className: 'takeaway-text',
                        children: o,
                      }),
                    ],
                  },
                  u,
                ),
              ),
            }),
          ],
        }),
      p.jsx('div', {
        className: 'step-footer-actions',
        children: p.jsx('button', {
          className: 'learn-primary-btn',
          onClick: t,
          children: 'Understand & Continue',
        }),
      }),
    ],
  });
}
function Od({ step: e, bridgeClient: t, onComplete: n }) {
  const { title: r, description: l, patch: i, highlights: o } = e.config || {},
    [u, s] = K.useState(!1),
    [c, v] = K.useState(!1),
    m = async () => {
      if (!(!t || !i))
        try {
          if ((v(!0), await t.loadPatch(i), s(!0), o && Array.isArray(o)))
            for (const h of o) await t.highlight(h);
        } catch (h) {
          console.error('Failed to load demo patch:', h);
        } finally {
          v(!1);
        }
    };
  return (
    K.useEffect(() => {
      t && m();
    }, [t, e.id]),
    p.jsxs('div', {
      className: 'learn-step-content demo-step animate-fade-in',
      children: [
        r && p.jsx('h2', { className: 'step-title', children: r }),
        p.jsx('div', {
          className: 'step-body-text',
          children: p.jsx('p', { className: 'step-paragraph', children: l }),
        }),
        p.jsxs('div', {
          className: 'demo-patch-card',
          children: [
            p.jsxs('div', {
              className: 'demo-patch-status',
              children: [
                p.jsx('span', {
                  className: `status-indicator ${u ? 'status-active' : 'status-inactive'}`,
                }),
                p.jsx('span', {
                  className: 'status-label',
                  children: c
                    ? 'Configuring synthesizer...'
                    : u
                      ? 'Demo Patch Loaded'
                      : 'Patch Ready',
                }),
              ],
            }),
            p.jsx('button', {
              className: 'demo-reset-btn',
              onClick: m,
              disabled: c || !t,
              children: u ? 'Reset to Demo State' : 'Load Demo Patch',
            }),
          ],
        }),
        o &&
          Array.isArray(o) &&
          o.length > 0 &&
          p.jsx('div', {
            className: 'demo-highlights-info',
            children: p.jsxs('p', {
              className: 'highlight-hint',
              children: [
                p.jsx('span', { className: 'sparkle', children: '✦' }),
                ' Look at the glowing controls in the right panel! We have highlighted ',
                p.jsx('strong', { children: o.join(', ') }),
                ' to guide your attention.',
              ],
            }),
          }),
        p.jsx('div', {
          className: 'step-footer-actions',
          children: p.jsx('button', {
            className: 'learn-primary-btn',
            onClick: n,
            disabled: c,
            children: "I've Listened & Continue",
          }),
        }),
      ],
    })
  );
}
function Dd({ step: e, bridgeClient: t, onComplete: n }) {
  const { title: r, prompt: l, constraints: i, hint: o } = e.config || {};
  return (
    K.useEffect(() => {
      if (t && i && Array.isArray(i)) {
        t.constrain(i);
        for (const u of i) t.highlight(u);
      }
      return () => {
        t && t.releaseConstraints();
      };
    }, [t, e.id, i]),
    p.jsxs('div', {
      className: 'learn-step-content prompt-step animate-fade-in',
      children: [
        r && p.jsx('h2', { className: 'step-title', children: r }),
        p.jsxs('div', {
          className: 'prompt-challenge-card',
          children: [
            p.jsxs('div', {
              className: 'challenge-header',
              children: [
                p.jsx('span', {
                  className: 'challenge-badge',
                  children: 'ACTIVE EXPERIMENT',
                }),
                p.jsxs('span', {
                  className: 'challenge-lock-icon',
                  children: [
                    p.jsxs('svg', {
                      viewBox: '0 0 24 24',
                      width: '12',
                      height: '12',
                      fill: 'none',
                      stroke: 'currentColor',
                      strokeWidth: '2',
                      style: { marginRight: '4px', verticalAlign: 'middle' },
                      children: [
                        p.jsx('rect', {
                          x: '3',
                          y: '11',
                          width: '18',
                          height: '11',
                          rx: '2',
                          ry: '2',
                        }),
                        p.jsx('path', { d: 'M7 11V7a5 5 0 0 1 10 0v4' }),
                      ],
                    }),
                    'Controls Sandboxed',
                  ],
                }),
              ],
            }),
            p.jsx('p', { className: 'challenge-prompt', children: l }),
          ],
        }),
        i &&
          Array.isArray(i) &&
          p.jsxs('div', {
            className: 'unlocked-params-info',
            children: [
              p.jsx('span', {
                className: 'info-title',
                children: 'Sandboxed Parameters:',
              }),
              p.jsx('div', {
                className: 'unlocked-pills',
                children: i.map((u) =>
                  p.jsx('span', { className: 'unlocked-pill', children: u }, u),
                ),
              }),
              p.jsx('p', {
                className: 'unlocked-hint',
                children:
                  'All other controls are locked to isolate this specific sound relationship.',
              }),
            ],
          }),
        o &&
          p.jsx('div', {
            className: 'prompt-hint-card',
            children: p.jsxs('p', {
              className: 'hint-text',
              children: [p.jsx('strong', { children: 'Hint:' }), ' ', o],
            }),
          }),
        p.jsx('div', {
          className: 'step-footer-actions',
          children: p.jsx('button', {
            className: 'learn-primary-btn',
            onClick: () => {
              n();
            },
            children: "I've Tried This",
          }),
        }),
      ],
    })
  );
}
function Fd({ step: e, value: t, onChange: n, onComplete: r }) {
  const { title: l, prompt: i, placeholder: o } = e.config || {};
  return p.jsxs('div', {
    className: 'learn-step-content reflection-step animate-fade-in',
    children: [
      l && p.jsx('h2', { className: 'step-title', children: l }),
      p.jsx('div', {
        className: 'step-body-text',
        children: p.jsx('p', {
          className: 'step-paragraph',
          children:
            i ||
            'Reflect on the sound relationships and behaviors you observed in this exploration.',
        }),
      }),
      p.jsx('div', {
        className: 'reflection-textarea-container',
        children: p.jsx('textarea', {
          className: 'reflection-textarea',
          value: t,
          onChange: (u) => n(u.target.value),
          placeholder:
            o ||
            'Type your notes or observations here... (this is optional; feel free to proceed when ready)',
          rows: 6,
        }),
      }),
      p.jsx('div', {
        className: 'step-footer-actions',
        children: p.jsx('button', {
          className: 'learn-primary-btn',
          onClick: r,
          children: 'Save Notes & Continue',
        }),
      }),
    ],
  });
}
function Ud({
  step: e,
  bridgeClient: t,
  onStepComplete: n,
  reflectionValue: r = '',
  onChangeReflection: l,
}) {
  switch (e.type) {
    case 'text':
      return p.jsx(Id, { step: e, onComplete: n });
    case 'demo':
      return p.jsx(Od, { step: e, bridgeClient: t, onComplete: n });
    case 'prompt':
      return p.jsx(Dd, { step: e, bridgeClient: t, onComplete: n });
    case 'reflection':
      return p.jsx(Fd, {
        step: e,
        value: r,
        onChange: l || (() => {}),
        onComplete: n,
      });
    default:
      return p.jsxs('div', {
        className: 'unknown-step',
        children: [
          p.jsxs('p', { children: ['Unknown step type: ', e.type] }),
          p.jsx('button', {
            className: 'learn-step-btn',
            onClick: n,
            children: 'Continue',
          }),
        ],
      });
  }
}
class Ad {
  constructor(t = 'anneal_music_bridge') {
    Oe(this, 'channel');
    Oe(this, 'onMessageCallback');
    ((this.channel = new BroadcastChannel(t)),
      (this.onMessageCallback = () => {}),
      (this.channel.onmessage = (n) => {
        this.onMessageCallback(n.data);
      }));
  }
  send(t) {
    this.channel.postMessage(t);
  }
  onMessage(t) {
    this.onMessageCallback = t;
  }
  close() {
    this.channel.close();
  }
}
class $d {
  constructor(t) {
    Oe(this, 'transport');
    Oe(this, 'nextId', 1);
    Oe(this, 'pendingRequests', new Map());
    Oe(this, 'subscriptionCallbacks', new Map());
    ((this.transport = t || new Ad()),
      this.transport.onMessage((n) => this.handleMessage(n)));
  }
  handleMessage(t) {
    if (t) {
      if (
        (console.log('[BridgeClient] Received message:', t),
        t.id !== void 0 && t.id !== null && t.method === void 0)
      ) {
        const n = this.pendingRequests.get(t.id);
        n &&
          (this.pendingRequests.delete(t.id),
          t.error ? n.reject(new Error(t.error.message)) : n.resolve(t.result));
      } else if (t.method === 'anneal.state.onChange') {
        const { subscriptionId: n, key: r, value: l } = t.params,
          i = this.subscriptionCallbacks.get(n);
        i && i({ key: r, value: l });
      }
    }
  }
  call(t, n) {
    const r = this.nextId++,
      l = { jsonrpc: '2.0', method: t, params: n, id: r };
    return new Promise((i, o) => {
      (this.pendingRequests.set(r, { resolve: i, reject: o }),
        this.transport.send(l));
    });
  }
  async getVersion() {
    return this.call('anneal.version');
  }
  async health() {
    return this.call('anneal.health');
  }
  async getState() {
    return this.call('anneal.state.get');
  }
  async setState(t) {
    return this.call('anneal.state.set', { params: t });
  }
  async setEngineParam(t, n, r) {
    return this.call('anneal.state.setEngineParam', {
      engineId: t,
      key: n,
      value: r,
    });
  }
  async setEngine(t) {
    return this.call('anneal.state.setEngine', { engineId: t });
  }
  async setTuning(t) {
    return this.call('anneal.state.setTuning', { tuning: t });
  }
  async subscribe(t, n) {
    const l = (await this.call('anneal.state.subscribe', { keys: t }))
      .subscriptionId;
    return (this.subscriptionCallbacks.set(l, n), l);
  }
  async unsubscribe(t) {
    const n = await this.call('anneal.state.unsubscribe', {
      subscriptionId: t,
    });
    return (n && this.subscriptionCallbacks.delete(t), n);
  }
  async getSpectrum() {
    return this.call('anneal.engine.getSpectrum');
  }
  async getPartials() {
    return this.call('anneal.engine.getPartials');
  }
  async startSession() {
    return this.call('anneal.session.start');
  }
  async stopSession() {
    return this.call('anneal.session.stop');
  }
  async getSessionStatus() {
    return this.call('anneal.session.status');
  }
  async loadPatch(t) {
    return this.call('anneal.lesson.loadPatch', { patch: t });
  }
  async loadPiece(t) {
    return this.call('anneal.lesson.loadPiece', { piece: t });
  }
  async highlight(t) {
    return this.call('anneal.lesson.highlight', { controlKey: t });
  }
  async constrain(t) {
    return this.call('anneal.lesson.constrain', { constraints: t });
  }
  async releaseConstraints() {
    return this.call('anneal.lesson.releaseConstraints');
  }
  close() {
    this.transport.close();
  }
}
class Bd {
  constructor(t) {
    Oe(this, 'onMessageCallback');
    Oe(this, 'targetWindow', null);
    Oe(this, 'handleMessage', (t) => {
      if (t.origin !== window.location.origin) return;
      const n = t.data;
      n && typeof n == 'object' && 'jsonrpc' in n && this.onMessageCallback(n);
    });
    ((this.onMessageCallback = () => {}),
      t
        ? (this.targetWindow = t)
        : typeof window < 'u' &&
          window.self !== window.top &&
          (this.targetWindow = window.parent),
      typeof window < 'u' &&
        window.addEventListener('message', this.handleMessage));
  }
  send(t) {
    this.targetWindow
      ? this.targetWindow.postMessage(t, window.location.origin)
      : console.warn('[PostMessageTransport] No target window set for send.');
  }
  setTargetWindow(t) {
    this.targetWindow = t;
  }
  onMessage(t) {
    this.onMessageCallback = t;
  }
  close() {
    typeof window < 'u' &&
      window.removeEventListener('message', this.handleMessage);
  }
}
function Vd({ track: e, lesson: t, onClose: n }) {
  var y;
  const [r, l] = K.useState(0),
    [i, o] = K.useState({}),
    u = K.useRef(null),
    [s, c] = K.useState(null),
    [v, m] = K.useState(!1),
    h = ((y = t.steps) == null ? void 0 : y.length) || 0,
    S = r === h - 1,
    w = r === h;
  K.useEffect(
    () => () => {
      s &&
        s.releaseConstraints().catch((k) => {
          console.warn('Failed to release constraints on unmount:', k);
        });
    },
    [s],
  );
  const x = () => {
      if (u.current && u.current.contentWindow)
        try {
          const k = new Bd(u.current.contentWindow),
            E = new $d(k);
          (c(E),
            console.log('[LessonPlayer] Connected to embedded app bridge.'));
        } catch (k) {
          console.error(
            '[LessonPlayer] Failed to initialize postMessage bridge:',
            k,
          );
        }
    },
    M = async () => {
      if (s)
        try {
          await s.releaseConstraints();
        } catch (k) {
          console.warn('Failed to release constraints:', k);
        }
      r < h && l(r + 1);
    },
    f = async () => {
      if (s)
        try {
          await s.releaseConstraints();
        } catch (k) {
          console.warn('Failed to release constraints:', k);
        }
      r > 0 && l(r - 1);
    },
    a = (k, E) => {
      o((_) => ({ ..._, [k]: E }));
    },
    d = w ? null : t.steps[r];
  return p.jsxs('div', {
    className: 'lesson-player-container',
    children: [
      p.jsxs('div', {
        className: 'lesson-chrome-panel',
        children: [
          p.jsxs('header', {
            className: 'player-header',
            children: [
              p.jsx('button', {
                className: 'exit-btn',
                onClick: n,
                'aria-label': 'Exit lesson',
                children: p.jsxs('svg', {
                  viewBox: '0 0 24 24',
                  width: '20',
                  height: '20',
                  fill: 'none',
                  stroke: 'currentColor',
                  strokeWidth: '2',
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                  children: [
                    p.jsx('line', { x1: '18', y1: '6', x2: '6', y2: '18' }),
                    p.jsx('line', { x1: '6', y1: '6', x2: '18', y2: '18' }),
                  ],
                }),
              }),
              p.jsxs('div', {
                className: 'player-title-block',
                children: [
                  p.jsx('span', {
                    className: 'player-track-tag',
                    style: { color: e.color },
                    children: e.title,
                  }),
                  p.jsx('h1', {
                    className: 'player-lesson-title',
                    children: t.title,
                  }),
                ],
              }),
            ],
          }),
          !w &&
            h > 0 &&
            p.jsx('div', {
              className: 'player-progress-bar',
              children: Array.from({ length: h }).map((k, E) =>
                p.jsx(
                  'span',
                  {
                    className: `progress-dot ${E === r ? 'dot-active' : E < r ? 'dot-completed' : 'dot-upcoming'}`,
                  },
                  E,
                ),
              ),
            }),
          p.jsx('main', {
            className: 'player-step-body',
            children: w
              ? p.jsxs('div', {
                  className: 'learn-step-content summary-step animate-fade-in',
                  children: [
                    p.jsx('h2', {
                      className: 'step-title',
                      children: 'Lesson Completed',
                    }),
                    p.jsxs('p', {
                      className: 'step-paragraph',
                      children: [
                        "You've successfully completed ",
                        p.jsx('strong', { children: t.title }),
                        '! Here is a summary of your personal reflection notes from this session.',
                      ],
                    }),
                    p.jsx('div', {
                      className: 'summary-notes-container',
                      children: t.steps
                        .filter((k) => k.type === 'reflection')
                        .map((k, E) => {
                          var j, U, z;
                          const _ = (j = i[k.id]) == null ? void 0 : j.trim();
                          return p.jsxs(
                            'div',
                            {
                              className: 'summary-note-card',
                              children: [
                                p.jsxs('h4', {
                                  className: 'note-prompt-title',
                                  children: [
                                    'Reflection ',
                                    E + 1,
                                    ': ',
                                    ((U = k.config) == null
                                      ? void 0
                                      : U.title) || 'Notes',
                                  ],
                                }),
                                p.jsxs('p', {
                                  className: 'note-prompt-desc',
                                  children: [
                                    '"',
                                    (z = k.config) == null ? void 0 : z.prompt,
                                    '"',
                                  ],
                                }),
                                p.jsx('blockquote', {
                                  className: 'note-text-body',
                                  children:
                                    _ ||
                                    p.jsx('span', {
                                      className: 'empty-note',
                                      children: 'No response was recorded.',
                                    }),
                                }),
                              ],
                            },
                            k.id,
                          );
                        }),
                    }),
                    p.jsx('div', {
                      className: 'step-footer-actions',
                      children: p.jsx('button', {
                        className: 'learn-primary-btn',
                        onClick: n,
                        children: 'Finish & Return to Curriculum',
                      }),
                    }),
                  ],
                })
              : d
                ? p.jsx(Ud, {
                    step: d,
                    bridgeClient: s,
                    onStepComplete: M,
                    reflectionValue: i[d.id] || '',
                    onChangeReflection: (k) => a(d.id, k),
                  })
                : p.jsx('div', {
                    className: 'empty-player',
                    children: 'No steps registered for this lesson.',
                  }),
          }),
          !w &&
            p.jsxs('footer', {
              className: 'player-footer',
              children: [
                p.jsx('button', {
                  className: 'player-nav-btn back-btn',
                  onClick: f,
                  disabled: r === 0,
                  children: 'Back',
                }),
                p.jsxs('div', {
                  className: 'step-counter-text',
                  children: ['Step ', r + 1, ' of ', h],
                }),
                p.jsx('button', {
                  className: 'player-nav-btn next-btn',
                  onClick: M,
                  children: S ? 'Complete' : 'Next',
                }),
              ],
            }),
        ],
      }),
      p.jsxs('div', {
        className: `lesson-iframe-panel ${v ? 'iframe-expanded' : 'iframe-collapsed'}`,
        children: [
          p.jsx('div', {
            className: 'iframe-mobile-controls',
            children: p.jsx('button', {
              className: 'iframe-toggle-btn',
              onClick: () => m(!v),
              children: v ? 'Minimize App' : 'Expand App',
            }),
          }),
          p.jsx('div', {
            className: 'iframe-wrapper',
            children: p.jsx('iframe', {
              ref: u,
              src: '/',
              title: 'AnnealMusic Live Synthesizer',
              className: 'embedded-app-iframe',
              onLoad: x,
            }),
          }),
        ],
      }),
    ],
  });
}
function Wd() {
  const [e, t] = K.useState([]),
    [n, r] = K.useState(!0),
    [l, i] = K.useState(null),
    [o, u] = K.useState(null),
    [s, c] = K.useState(null),
    v = ''.replace(/\/$/, '');
  (K.useEffect(() => {
    async function S() {
      try {
        r(!0);
        const w = await fetch(`${v}/api/v1/tracks`);
        if (!w.ok)
          throw new Error(`Failed to fetch curriculum: ${w.statusText}`);
        const x = await w.json();
        (t(x.items || []), i(null));
      } catch (w) {
        (console.error(w),
          i(w.message || 'An error occurred loading the curriculum.'));
      } finally {
        r(!1);
      }
    }
    S();
  }, [v]),
    K.useEffect(() => {
      function S() {
        const w = window.location.hash;
        if (!w) {
          (u(null), c(null));
          return;
        }
        const x = w.split('/');
        if (x[0] === '#lesson' && x.length === 3) {
          const M = x[1],
            f = x[2],
            a = e.find((d) => d.slug === M);
          if (a) {
            const d = a.lessons.find((y) => y.slug === f);
            if (d) {
              (u(a), c(d));
              return;
            }
          }
        }
        (u(null), c(null));
      }
      return (
        e.length > 0 && (S(), window.addEventListener('hashchange', S)),
        () => {
          window.removeEventListener('hashchange', S);
        }
      );
    }, [e]));
  const m = () => {
      window.location.hash = '';
    },
    h = (S, w) => {
      window.location.hash = `#lesson/${S}/${w}`;
    };
  return n
    ? p.jsxs('div', {
        className: 'learn-loading-container',
        children: [
          p.jsx('div', { className: 'learn-spinner' }),
          p.jsx('p', {
            className: 'learn-loading-text',
            children: 'Loading curriculum...',
          }),
        ],
      })
    : l
      ? p.jsx('div', {
          className: 'learn-error-container',
          children: p.jsxs('div', {
            className: 'learn-error-card',
            children: [
              p.jsx('h2', { children: 'Failed to load curriculum' }),
              p.jsx('p', { className: 'learn-error-text', children: l }),
              p.jsx('button', {
                className: 'learn-retry-btn',
                onClick: () => window.location.reload(),
                children: 'Retry',
              }),
            ],
          }),
        })
      : p.jsx('div', {
          className: 'learn-app-container',
          children: s
            ? p.jsx(Vd, { track: o, lesson: s, onClose: m })
            : p.jsx(Md, { tracks: e, onSelectLesson: h }),
        });
}
const nc = document.getElementById('learn-root');
if (!nc) throw new Error('Root element #learn-root not found');
ba(nc).render(K.createElement(Wd));
