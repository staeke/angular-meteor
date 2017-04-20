'use strict';
import { EventEmitter } from '@angular/core';
import { check, gZone, g, debounce, noop } from './utils';
import { CursorHandle } from './cursor_handle';
var AddChange = (function () {
    function AddChange(index, item) {
        this.index = index;
        this.item = item;
    }
    return AddChange;
}());
export { AddChange };
var UpdateChange = (function () {
    function UpdateChange(index, item) {
        this.index = index;
        this.item = item;
    }
    return UpdateChange;
}());
export { UpdateChange };
var MoveChange = (function () {
    function MoveChange(fromIndex, toIndex) {
        this.fromIndex = fromIndex;
        this.toIndex = toIndex;
    }
    return MoveChange;
}());
export { MoveChange };
var RemoveChange = (function () {
    function RemoveChange(index) {
        this.index = index;
    }
    return RemoveChange;
}());
export { RemoveChange };
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
}(EventEmitter));
export { MongoCursorObserver };
