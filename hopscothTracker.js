(function ($, hopscotch) {
  "use strict";
  if ($ && hopscotch) {
    /*
      * This hopscotch tracker will bind a document level mouseup event to end or restart tour automatically.
      * Default ending logic: if current tour target hidden or position changed, end the tour.
      * Implement options.onEndingTour($currentStepTarget, targetStatus) function if the default ending logic is not satisfied.
      * Default restarting logic: if there is no active tour and the target is visible, restart tour.
      * Implement options.onRestartingTour($currentStepTarget) function if the default restarting logic is not satisfied.
      * Default timeout after mouse up: 200 ms
      * Set options.timeout value if the defual timeout is not satisfied.
      * Implement options.callback function if extra operation required when tracker initialized.
    */
    var hopscothTrackerBase = {
      options: {
        timeout: 200,
        onEndingTour: $.noop,
        onRestartingTour: $.noop
      },
 
      trackerId: null,
      trackingTour: null,
      trackEventName: null,
      currentStepNum: 0,
      oldTargetPosition: null,
 
      _init: function (options) {
        var that = this;
 
        $.extend(that.options, options || {});
        that.trackEventName = "mouseup." + that.trackerId;
 
        that._destroyTrackEvent();
        that._bindTrackEvent();
 
        if ($.isFunction(that.options.callback)) {
          that.options.callback.call(that);
        }
      },
      destroy: function () {
        this._destroyTrackEvent();
      },
      _destroyTrackEvent: function () {
        $(document).off(this.trackEventName);
      },
      _bindTrackEvent: function () {
        var that = this,
          $document = $(document);
 
        $document.on(that.trackEventName, function (e) {
          var $eventTarget = $(e.target),
            $hopscotchBubble = that._getHopscotchBubble();
 
          if (that._isTrackingTourActive()) {
            that._refreshCurrentStep();
            that.oldTargetPosition = that._getCurrentStepTarget().offset();
 
            // when clicking hopscotch bubble, return.
            if ($hopscotchBubble.is($eventTarget) || $hopscotchBubble.has($eventTarget).length) {
              // when clicking close or done button of hopscotch bubble, destroy tracker.
              if (that._isClosingTour($eventTarget)) {
                that.destroy();
              }
              return;
            }
          }
 
          setTimeout(function () {
            var $currentStepTarget = that._getCurrentStepTarget(),
              targetStatus,
              customEndTourFlag,
              customRestartTourFlag;
 
            // if current tour target removed, dispose tour and destroy tracker then return.
            if ($(document).has($currentStepTarget).length === 0) {
              that._disposeTour();
              that.destroy();
              return;
            }
 
            if (that._isTrackingTourActive()) {
              targetStatus = that._getCurrentStepTargetStatus();
              // if current tour target is invisible or position changed, dispose tour.
              if (!targetStatus.isCurrentTargetVisible ||targetStatus.isPositionChanged) {
                if ($.isFunction(that.options.onEndingTour)) {
                  customEndTourFlag = that.options.onEndingTour($currentStepTarget,targetStatus);
                }
                if (customEndTourFlag !== false) {
                  that._disposeTour();
                }
              }
            }
 
            // if current tour has been disposed and current tour step target is visible, restart tour.
            if (!that._isTrackingTourActive() &&
                typeof that.currentStepNum === "number" &&
                $currentStepTarget.length && $currentStepTarget.is(":visible")) {
              if ($.isFunction(that.options.onRestartingTour)) {
                customRestartTourFlag =that.options.onRestartingTour($currentStepTarget);
              }
              if (customRestartTourFlag !== false) {
                that._restartTour();
              }
            }
          }, that.options.timeout);
        });
      },
      _getHopscotchBubble: function () {
        return $(".hopscotch-bubble");
      },
      _isTrackingTourActive: $.noop,
      _refreshCurrentStep: $.noop,
      _isClosingTour: $.noop,
      _disposeTour: $.noop,
      _restartTour: $.noop,
      _getCurrentStepTarget: $.noop,
      _getCurrentStepTargetStatus: function () {
        var that = this,
          $currentStepTarget = that._getCurrentStepTarget(),
          oldTargetPosition = that.oldTargetPosition,
          newTargetPosition = $currentStepTarget.offset();
 
        return {
          isCurrentTargetVisible: $currentStepTarget.is(":visible"),
          isPositionChanged: Math.abs(oldTargetPosition.left - newTargetPosition.left) > 1
            || Math.abs(oldTargetPosition.top - newTargetPosition.top) > 1
        };
      }
   };
 
    hopscotch.TourTracker = function (options) {
      var that = this;
      that.trackingTour = hopscotch.getCurrTour();
      that.trackerId = "trackTour-" + that.trackingTour.id;
      that._init(options);
    };
    $.extend(hopscotch.TourTracker.prototype, hopscothTrackerBase, {
      _isTrackingTourActive: function () {
        return hopscotch.isActive && hopscotch.getCurrTour().id ===this.trackingTour.id;
      },
      _refreshCurrentStep: function () {
        var that = this;
        that.currentStepNum = hopscotch.getCurrStepNum();
      },
      _getCurrentStepTarget: function () {
        var that = this;
        return $(that.trackingTour.steps[that.currentStepNum].target);
      },
      _isClosingTour: function ($eventTarget) {
        var that = this;
        return $eventTarget.hasClass("hopscotch-close") ||
          ($eventTarget.hasClass("hopscotch-next") && that.trackingTour.steps.length - 1 === that.currentStepNum);
      },
      _disposeTour: function () {
        hopscotch.endTour(false, false);
      },
      _restartTour: function () {
        var that = this;
        if (!hopscotch.isActive) {
          hopscotch.startTour(that.trackingTour, that.currentStepNum);
        }
      }
    });
 
    hopscotch.CalloutTracker = function (calloutId, options) {
      var that = this,
        calloutMgr = hopscotch.getCalloutManager();
      that.trackingTour = calloutMgr.getCallout(calloutId);
      that.trackerId = "trackCallout-" + that.trackingTour.opt.id;
      that._init(options);
    };
    $.extend(hopscotch.CalloutTracker.prototype, hopscothTrackerBase, {
      _getHopscotchBubble: function () {
        return $(this.trackingTour.element);
      },
      _isTrackingTourActive: function () {
        var callout = hopscotch.getCalloutManager().getCallout(this.trackingTour.opt.id);
        return callout !== null;
      },
      _getCurrentStepTarget: function () {
        return $(this.trackingTour.opt.target);
      },
      _isClosingTour: function ($eventTarget) {
        return $eventTarget.hasClass("hopscotch-cta") || $eventTarget.hasClass("hopscotch-close");
      },
      _disposeTour: function () {
        hopscotch.getCalloutManager().removeCallout(this.trackingTour.opt.id);
      },
      _restartTour: function () {
        hopscotch.getCalloutManager().createCallout(this.trackingTour.opt);
      },
 
      _superTargetStatus: hopscothTrackerBase._getCurrentStepTargetStatus,
      _getCurrentStepTargetStatus: function () {
        var that = this,
          $currentStepTarget = that._getCurrentStepTarget(),
          newTargetPosition = $currentStepTarget.offset(),
          isTargetOutOfScreen = $(document).width() - newTargetPosition.left - $currentStepTarget.width() < 0,
          targetStatus = that._superTargetStatus();
 
        targetStatus.isCurrentTargetVisible = targetStatus.isCurrentTargetVisible && !isTargetOutOfScreen;
 
        return targetStatus;
      }
    });
  }
}(jQuery, window.hopscotch));