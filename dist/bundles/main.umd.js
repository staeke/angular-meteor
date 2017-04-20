(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('angular2-meteor-polyfills'), require('underscore'), require('@angular/core')) :
	typeof define === 'function' && define.amd ? define(['exports', 'angular2-meteor-polyfills', 'underscore', '@angular/core'], factory) :
	(factory((global.ng = global.ng || {}, global.ng.meteor = global.ng.meteor || {}),global.ng.meteor.polyfills,global.underscore,global.ng.core));
}(this, (function (exports,angular2MeteorPolyfills,_,_angular_core) { 'use strict';

var subscribeEvents = ['onReady', 'onError', 'onStop'];
function isMeteorCallbacks(callbacks) {
    return _.isFunction(callbacks) || isCallbacksObject(callbacks);
}
// Checks if callbacks of {@link CallbacksObject} type.
function isCallbacksObject(callbacks) {
    return callbacks && subscribeEvents.some(function (event) {
        return _.isFunction(callbacks[event]);
    });
}
var g = typeof global === 'object' ? global :
    typeof window === 'object' ? window :
        typeof self === 'object' ? self : undefined;
var gZone = g.Zone.current;
var check = Package['check'].check;
/* tslint:disable */

function debounce(func, wait, onInit) {
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

function noop() { }

/**
 * Contains a set of methods to schedule Zone runs.
 * Supposed to be used mostly in @MeteorReactive to patch
 * Meteor methods' callbacks.
 * After patching, callbacks will be run in the global zone
 * (i.e. outside of Angular 2), at the same time,
 * a Angular 2 zone run will be scheduled in order to
 * initiate UI update. In order to reduce number of
 * UI updates caused by the callbacks near the same time,
 * zone runs are debounced.
 */
var ZoneRunScheduler = (function () {
    function ZoneRunScheduler() {
        this._zoneTasks = new Map();
        this._onRunCbs = new Map();
    }
    ZoneRunScheduler.prototype.zoneRun = function (zone) {
        var _this = this;
        return function () {
            zone.run(noop);
            _this._runAfterRunCbs(zone);
            _this._zoneTasks.delete(zone);
        };
    };
    ZoneRunScheduler.prototype.runZones = function () {
        this._zoneTasks.forEach(function (task, zone) {
            task.invoke();
        });
    };
    ZoneRunScheduler.prototype._runAfterRunCbs = function (zone) {
        if (this._onRunCbs.has(zone)) {
            var cbs = this._onRunCbs.get(zone);
            while (cbs.length !== 0) {
                (cbs.pop())();
            }
            this._onRunCbs.delete(zone);
        }
    };
    ZoneRunScheduler.prototype.scheduleRun = function (zone) {
        if (zone === gZone) {
            return;
        }
        var runTask = this._zoneTasks.get(zone);
        if (runTask) {
            runTask.cancelFn(runTask);
            this._zoneTasks.delete(zone);
        }
        runTask = gZone.scheduleMacroTask('runZones', this.zoneRun(zone), { isPeriodic: true }, function (task) {
            task._tHandler = setTimeout(task.invoke);
        }, function (task) {
            clearTimeout(task._tHandler);
        });
        this._zoneTasks.set(zone, runTask);
    };
    ZoneRunScheduler.prototype.onAfterRun = function (zone, cb) {
        check(cb, Function);
        if (!this._zoneTasks.has(zone)) {
            cb();
            return;
        }
        var cbs = this._onRunCbs.get(zone);
        if (!cbs) {
            cbs = [];
            this._onRunCbs.set(zone, cbs);
        }
        cbs.push(cb);
    };
    return ZoneRunScheduler;
}());
var zoneRunScheduler = new ZoneRunScheduler();
function wrapFuncInZone(zone, method, context) {
    return function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        gZone.run(function () {
            method.apply(context, args);
        });
        zoneRunScheduler.scheduleRun(zone);
    };
}
function wrapCallbackInZone(zone, callback, context) {
    if (_.isFunction(callback)) {
        return wrapFuncInZone(zone, callback, context);
    }
    for (var _i = 0, _a = _.functions(callback); _i < _a.length; _i++) {
        var fn = _a[_i];
        callback[fn] = wrapFuncInZone(zone, callback[fn], context);
    }
    return callback;
}
function scheduleMicroTask(fn) {
    Zone.current.scheduleMicroTask('scheduleMicrotask', fn);
}

var CursorHandle = (function () {
    function CursorHandle(hCurObserver, hAutoNotify) {
        check(hAutoNotify, Match.Optional(Tracker.Computation));
        check(hCurObserver, Match.Where(function (observer) {
            return !!observer.stop;
        }));
        this._hAutoNotify = hAutoNotify;
        this._hCurObserver = hCurObserver;
    }
    CursorHandle.prototype.stop = function () {
        if (this._hAutoNotify) {
            this._hAutoNotify.stop();
        }
        this._hCurObserver.stop();
    };
    return CursorHandle;
}());

var AddChange = (function () {
    function AddChange(index, item) {
        this.index = index;
        this.item = item;
    }
    return AddChange;
}());
var UpdateChange = (function () {
    function UpdateChange(index, item) {
        this.index = index;
        this.item = item;
    }
    return UpdateChange;
}());
var MoveChange = (function () {
    function MoveChange(fromIndex, toIndex) {
        this.fromIndex = fromIndex;
        this.toIndex = toIndex;
    }
    return MoveChange;
}());
var RemoveChange = (function () {
    function RemoveChange(index) {
        this.index = index;
    }
    return RemoveChange;
}());
/**
 * Class that does a background work of observing
 * Mongo collection changes (through a cursor)
 * and notifying subscribers about them.
 */
var MongoCursorObserver = (function (_super) {
    __extends(MongoCursorObserver, _super);
    function MongoCursorObserver(cursor, _debounceMs) {
        if (_debounceMs === void 0) { _debounceMs = 50; }
        var _this = _super.call(this) || this;
        _this._debounceMs = _debounceMs;
        _this._lastChanges = [];
        _this._ngZone = g.Zone.current;
        _this._isSubscribed = false;
        check(cursor, Match.Where(MongoCursorObserver.isCursor));
        _this._cursor = cursor;
        return _this;
    }
    MongoCursorObserver.isCursor = function (cursor) {
        return cursor && !!cursor.observe;
    };
    MongoCursorObserver.prototype.subscribe = function (events) {
        var sub = _super.prototype.subscribe.call(this, events);
        // Start processing of the cursor lazily.
        if (!this._isSubscribed) {
            this._isSubscribed = true;
            this._hCursor = this._processCursor(this._cursor);
        }
        return sub;
    };
    Object.defineProperty(MongoCursorObserver.prototype, "lastChanges", {
        get: function () {
            return this._lastChanges;
        },
        enumerable: true,
        configurable: true
    });
    MongoCursorObserver.prototype.destroy = function () {
        if (this._hCursor) {
            this._hCursor.stop();
        }
        this._hCursor = null;
    };
    MongoCursorObserver.prototype._processCursor = function (cursor) {
        // On the server side fetch data, don't observe.
        if (Meteor.isServer) {
            var changes = [];
            var index = 0;
            for (var _i = 0, _a = cursor.fetch(); _i < _a.length; _i++) {
                var doc = _a[_i];
                changes.push(this._addAt(doc, index++));
            }
            this.emit(changes);
            return null;
        }
        var hCurObserver = this._startCursorObserver(cursor);
        return new CursorHandle(hCurObserver);
    };
    MongoCursorObserver.prototype._startCursorObserver = function (cursor) {
        var _this = this;
        var changes = [];
        var callEmit = function () {
            _this.emit(changes.slice());
            changes.length = 0;
        };
        // Since cursor changes are now applied in bulk
        // (due to emit debouncing), scheduling macro task
        // allows us to use MeteorApp.onStable,
        // i.e. to know when the app is stable.
        var scheduleEmit = function () {
            return _this._ngZone.scheduleMacroTask('emit', callEmit, null, noop);
        };
        var init = false;
        var runTask = function (task) {
            task.invoke();
            _this._ngZone.run(noop);
            init = true;
        };
        var emit = null;
        if (this._debounceMs) {
            emit = debounce(function (task) { return runTask(task); }, this._debounceMs, scheduleEmit);
        }
        else {
            var initAdd_1 = debounce(function (task) { return runTask(task); }, 0, scheduleEmit);
            emit = function () {
                // This is for the case when cursor.observe
                // is called multiple times in a row
                // when the initial docs are being added.
                if (!init) {
                    initAdd_1();
                    return;
                }
                runTask(scheduleEmit());
            };
        }
        return gZone.run(function () { return cursor.observe({
            addedAt: function (doc, index) {
                var change = _this._addAt(doc, index);
                changes.push(change);
                emit();
            },
            changedAt: function (nDoc, oDoc, index) {
                var change = _this._updateAt(nDoc, index);
                changes.push(change);
                emit();
            },
            movedTo: function (doc, fromIndex, toIndex) {
                var change = _this._moveTo(doc, fromIndex, toIndex);
                changes.push(change);
                emit();
            },
            removedAt: function (doc, atIndex) {
                var change = _this._removeAt(atIndex);
                changes.push(change);
                emit();
            }
        }); });
    };
    MongoCursorObserver.prototype._updateAt = function (doc, index) {
        return new UpdateChange(index, doc);
    };
    MongoCursorObserver.prototype._addAt = function (doc, index) {
        var change = new AddChange(index, doc);
        return change;
    };
    MongoCursorObserver.prototype._moveTo = function (doc, fromIndex, toIndex) {
        return new MoveChange(fromIndex, toIndex);
    };
    MongoCursorObserver.prototype._removeAt = function (index) {
        return new RemoveChange(index);
    };
    return MongoCursorObserver;
}(_angular_core.EventEmitter));

/**
 * A basic class to extend @Component and @Pipe.
 * Contains wrappers over main Meteor methods
 * that does some maintenance work behind the scene:
 * - Destroys subscription handles
 *   when the component or pipe is destroyed by Angular 2.
 * - Debounces ngZone runs reducing number of
 *   change detection runs.
 */
var MeteorReactive = (function () {
    function MeteorReactive() {
        this._hAutoruns = [];
        this._hSubscribes = [];
        this._ngZone = g.Zone.current;
    }
    /**
     * Method has the same notation as Meteor.autorun
     * except the last parameter.
     * @param {MeteorReactive~autorunCallback} func - Callback to be executed when current computation is
     * invalidated. The Tracker.Computation object will be passed as argument to
     * this callback.
     * @param {Boolean} autoBind - Determine whether Angular2 Zone will run
     *   after the func call to initiate change detection.
     * @returns {Tracker.Computation} - Object representing the Meteor computation
     * @example
     * class MyComponent extends MeteorReactive {
     *    private myData: Mongo.Cursor;
     *    private dataId: any;
     *
     *    constructor() {
     *      super();
     *
     *      this.autorun(() => {
     *        this.myData = MyCollection.find({ _id: dataId});
     *      }, true);
     *    }
     * }
     *
     * @see {@link https://docs.meteor.com/api/tracker.html#tracker_computation|Tracker.Computation in Meteor documentation}
     * @see {@link https://docs.meteor.com/api/tracker.html#Tracker-autorun|autorun in Meteor documentation}
     */
    MeteorReactive.prototype.autorun = function (func, autoBind) {
        if (autoBind === void 0) { autoBind = true; }
        var pargs = this._prepArgs([func, autoBind]).pargs;
        var hAutorun = Tracker.autorun(pargs[0]);
        this._hAutoruns.push(hAutorun);
        return hAutorun;
    };
    /**
     *  Method has the same notation as Meteor.subscribe:
     *    subscribe(name, [args1, args2], [callbacks], [autoBind])
     *  except the last autoBind param (see autorun above).
     *  @param {String} name - Name of the publication in the Meteor server
     *  @param {any} args - Parameters that will be forwarded to the publication.
     *  @param {Boolean} autoBind - Determine whether Angular 2 zone will run
     *   after the func call to initiate change detection.
     *  @returns {Meteor.SubscriptionHandle} - The handle of the subscription created by Meteor.
     *  @example
     *  class MyComponent extends MeteorReactive {
     *     constructor() {
     *       super();
     *
     *       this.subscribe("myData", 10);
     *     }
     *  }
     *
     *  @see {@link http://docs.meteor.com/api/pubsub.html|Publication/Subscription in Meteor documentation}
     */
    MeteorReactive.prototype.subscribe = function (name) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        var pargs = this._prepArgs(args).pargs;
        if (!Meteor.subscribe) {
            throw new Error('Meteor.subscribe is not defined on the server side');
        }
        var hSubscribe = Meteor.subscribe.apply(Meteor, [name].concat(pargs));
        if (Meteor.isClient) {
            this._hSubscribes.push(hSubscribe);
        }
        if (Meteor.isServer) {
            var callback = pargs[pargs.length - 1];
            if (_.isFunction(callback)) {
                callback();
            }
            if (isCallbacksObject(callback)) {
                callback.onReady();
            }
        }
        return hSubscribe;
    };
    /**
   *  Method has the same notation as Meteor.call:
   *    call(name, [args1, args2], [callbacks], [autoBind])
   *  except the last autoBind param (see autorun above).
   *  @param {String} name - Name of the publication in the Meteor server
   *  @param {any} args - Parameters that will be forwarded to the method.
   *  @param {Boolean} autoBind - autoBind Determine whether Angular 2 zone will run
   *   after the func call to initiate change detection.
   *  @example
   *  class MyComponent extends MeteorReactive {
   *     constructor() {
   *       super();
   *
   *       this.call("serverMethod", (err, result) => {
   *          // Handle response...
   *       });
   *     }
   *  }
   *
   *  @return {void}
   */
    MeteorReactive.prototype.call = function (name) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        var pargs = this._prepArgs(args).pargs;
        return Meteor.call.apply(Meteor, [name].concat(pargs));
    };
    MeteorReactive.prototype.ngOnDestroy = function () {
        for (var _i = 0, _a = this._hAutoruns; _i < _a.length; _i++) {
            var hAutorun = _a[_i];
            hAutorun.stop();
        }
        for (var _b = 0, _c = this._hSubscribes; _b < _c.length; _b++) {
            var hSubscribe = _c[_b];
            hSubscribe.stop();
        }
        this._hAutoruns = null;
        this._hSubscribes = null;
    };
    MeteorReactive.prototype._prepArgs = function (args) {
        var lastParam = args[args.length - 1];
        var penultParam = args[args.length - 2];
        var autoBind = true;
        if (_.isBoolean(lastParam) &&
            isMeteorCallbacks(penultParam)) {
            args.pop();
            autoBind = lastParam !== false;
        }
        lastParam = args[args.length - 1];
        if (isMeteorCallbacks(lastParam)) {
            args.pop();
        }
        else {
            lastParam = noop;
        }
        // If autoBind is set to false then
        // we run user's callback in the global zone
        // instead of the current Angular 2 zone.
        var zone = autoBind ? this._ngZone : gZone;
        lastParam = wrapCallbackInZone(zone, lastParam, this);
        args.push(lastParam);
        return { pargs: args, autoBind: autoBind };
    };
    return MeteorReactive;
}());
/**
 * This callback called when autorun triggered by Meteor.
 * @callback MeteorReactive~autorunCallback
 * @param {Tracker.Computation} computation
 */
// For the versions compatibility.
/* tslint:disable */
var MeteorComponent = MeteorReactive;

exports.ZoneRunScheduler = ZoneRunScheduler;
exports.zoneRunScheduler = zoneRunScheduler;
exports.wrapCallbackInZone = wrapCallbackInZone;
exports.scheduleMicroTask = scheduleMicroTask;
exports.AddChange = AddChange;
exports.UpdateChange = UpdateChange;
exports.MoveChange = MoveChange;
exports.RemoveChange = RemoveChange;
exports.MongoCursorObserver = MongoCursorObserver;
exports.MeteorReactive = MeteorReactive;
exports.MeteorComponent = MeteorComponent;

Object.defineProperty(exports, '__esModule', { value: true });

})));
