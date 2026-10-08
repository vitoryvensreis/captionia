/* Caption IA — conservative scheduler for AutoEdit SFX.
 * Controls spacing at the CLIENT planning boundary, without touching jsxbin.
 * Explicit caption endTimes are intentionally omitted in AutoEdit so the
 * host doesn't truncate source audio merely because the caption ends.
 * The host may still enforce sequence end / track overlap limits.
 */
(function (root) {
  'use strict';
  function finite(v) { return typeof v === 'number' && isFinite(v); }
  function plan(times, ends, options) {
    options = options || {};
    if (!Array.isArray(times)) throw new TypeError('SFX times must be an array.');
    var fps = finite(options.fps) && options.fps >= 12 && options.fps <= 120 ? options.fps : 30;
    var minGap = finite(options.minGapSeconds) ? Math.max(0.5, Math.min(2.5, options.minGapSeconds)) : 0.85;
    // Convert to an integer frame distance to avoid floating-point collisions.
    var gapFrames = Math.max(1, Math.ceil(minGap * fps));
    var ordered = [], invalid = 0;
    for (var i = 0; i < times.length; i++) {
      var value = times[i];
      if (!finite(value) || value < 0 || value > 21600) { invalid++; continue; }
      var boundary = Array.isArray(ends) && ends.length === times.length ? ends[i] : null;
      if (finite(boundary) && boundary <= value + 1 / fps) { invalid++; continue; }
      ordered.push({ frame: Math.round(value * fps), index: i });
    }
    ordered.sort(function(a,b) { return a.frame-b.frame || a.index-b.index; });
    var result = [], last = -Infinity, spacing = 0, duplicate = 0;
    var limit = Math.max(1, Math.min(1200, options.maxEvents || 500));
    for (var j = 0; j < ordered.length; j++) {
      var frame = ordered[j].frame;
      if (frame === last) { duplicate++; continue; }
      if (frame - last < gapFrames || result.length >= limit) { spacing++; continue; }
      result.push(frame/fps);
      last = frame;
    }
    return {
      times: result,
      fins: [],  // Do not trim at the end of each caption in AutoEdit.
      received: times.length,
      omittedInvalid: invalid,
      omittedDuplicate: duplicate,
      omittedSpacing: spacing,
      gapSeconds: gapFrames/fps,
      strategy: 'one-per-block-with-cooldown'
    };
  }
  var api = Object.freeze({plan:plan});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CaptionIASfxScheduler = api;
})(typeof window !== 'undefined' ? window : null);
