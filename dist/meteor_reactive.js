'use strict';
import * as _ from 'underscore';
import { isMeteorCallbacks, isCallbacksObject, gZone, g, noop } from './utils';
import { wrapCallbackInZone } from './zone_utils';
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
export { MeteorReactive };
/**
 * This callback called when autorun triggered by Meteor.
 * @callback MeteorReactive~autorunCallback
 * @param {Tracker.Computation} computation
 */
// For the versions compatibility.
/* tslint:disable */
export var MeteorComponent = MeteorReactive;
