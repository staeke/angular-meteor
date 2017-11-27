'use strict';
import * as _ from 'underscore';
export var subscribeEvents = ['onReady', 'onError', 'onStop'];
export function isMeteorCallbacks(callbacks) {
    return _.isFunction(callbacks) || isCallbacksObject(callbacks);
}
// Checks if callbacks of {@link CallbacksObject} type.
export function isCallbacksObject(callbacks) {
    return callbacks && subscribeEvents.some(function (event) {
        return _.isFunction(callbacks[event]);
    });
}
export var g = typeof global === 'object' ? global :
    typeof window === 'object' ? window :
        typeof self === 'object' ? self : this;
export var gZone = g.Zone.current;
export var check = Package['check'].check;
/* tslint:disable */
export var Match = Package['check'].Match;
export function debounce(func, wait, onInit) {
    var timeout, result, data;
    var later = function (context, args) {
        timeout = null;
        result = func.apply(context, args.concat([data]));
    };
    var debounced = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        if (!timeout) {
            data = onInit && onInit();
        }
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = _.delay(later, wait, this, args);
        return result;
    };
    return debounced;
}
;
export function noop() { }
export function isListLikeIterable(obj) {
    if (!isJsObject(obj))
        return false;
    return isArray(obj) ||
        (!(obj instanceof Map) &&
            getSymbolIterator() in obj); // JS Iterable have a Symbol.iterator prop
}
export function isArray(obj) {
    return Array.isArray(obj);
}
export function isPresent(obj) {
    return obj !== undefined && obj !== null;
}
export function isBlank(obj) {
    return obj === undefined || obj === null;
}
export function isJsObject(o) {
    return o !== null && (typeof o === 'function' || typeof o === 'object');
}
var _symbolIterator = null;
export function getSymbolIterator() {
    if (isBlank(_symbolIterator)) {
        if (isPresent(g.Symbol) && isPresent(Symbol.iterator)) {
            _symbolIterator = Symbol.iterator;
        }
        else {
            // es6-shim specific logic
            var keys = Object.getOwnPropertyNames(Map.prototype);
            for (var i = 0; i < keys.length; ++i) {
                var key = keys[i];
                if (key !== 'entries' && key !== 'size' &&
                    Map.prototype[key] === Map.prototype['entries']) {
                    _symbolIterator = key;
                }
            }
        }
    }
    return _symbolIterator;
}