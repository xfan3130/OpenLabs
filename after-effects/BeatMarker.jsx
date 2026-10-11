/*
 * BeatMarker.jsx — automatic beat markers for Adobe After Effects
 *
 * Analyses the audio of the selected layer and drops a marker on every beat.
 *
 * Install:
 *   - Dockable panel: copy to  .../Adobe After Effects <version>/Scripts/ScriptUI Panels/
 *     then open it from the Window menu.
 *   - One-off: File > Scripts > Run Script File... and pick this file.
 *
 * Usage:
 *   1. Open a composition and select a layer that has audio.
 *   2. Choose an intensity preset (or tune Sensitivity / Min spacing / Every Nth beat).
 *   3. Click "Mark Beats". Tweak the controls and click again — the audio is only
 *      analysed once, so re-marking is instant. Previous beat markers are replaced.
 *
 * How it works:
 *   AE's "Convert Audio to Keyframes" command produces a per-frame amplitude curve.
 *   A frame counts as a beat when it is a local peak that stands out above the
 *   surrounding average loudness by a factor set by Sensitivity, and is far enough
 *   from the previous beat (Min spacing).
 */

(function BeatMarker(thisObj) {
    var SCRIPT_NAME = "Beat Marker";
    var MARKER_TAG = "Beat";

    // Intensity presets: sensitivity (1-100), minimum spacing (ms), keep every Nth beat
    var PRESETS = [
        { name: "Light (strong hits only)", sensitivity: 25, spacing: 400, every: 1 },
        { name: "Medium", sensitivity: 50, spacing: 250, every: 1 },
        { name: "Heavy", sensitivity: 75, spacing: 150, every: 1 },
        { name: "Insane (every transient)", sensitivity: 95, spacing: 80, every: 1 },
        { name: "Custom", sensitivity: null, spacing: null, every: null }
    ];
    var EVERY_OPTIONS = [1, 2, 4, 8];

    // Cached analysis so re-marking with new settings doesn't re-run the conversion.
    var cache = null; // { compId, layerIndex, layerName, frameRate, times[], amps[] }

    // ------------------------------------------------------------------ analysis

    function isAnalysisValid(comp, layer) {
        return cache !== null &&
            cache.compId === comp.id &&
            cache.layerIndex === layer.index &&
            cache.layerName === layer.name &&
            cache.frameRate === comp.frameRate &&
            cache.workAreaStart === comp.workAreaStart &&
            cache.workAreaDuration === comp.workAreaDuration;
    }

    function analyseAudio(comp, layer) {
        var cmdId = app.findMenuCommandId("Convert Audio to Keyframes");
        if (!cmdId) {
            throw new Error("Couldn't find the \"Convert Audio to Keyframes\" command " +
                "(it may be named differently in a non-English After Effects).");
        }

        // Mute every other audio layer so only the target layer is analysed.
        var muted = [];
        var i, l;
        for (i = 1; i <= comp.numLayers; i++) {
            l = comp.layer(i);
            if (l !== layer && l.hasAudio && l.audioEnabled) {
                l.audioEnabled = false;
                muted.push(l);
            }
        }
        var targetWasEnabled = layer.audioEnabled;
        layer.audioEnabled = true;

        var amplitudeLayer = null;
        var times = [];
        var amps = [];
        try {
            try { comp.openInViewer(); } catch (e) { /* older AE: comp must already be active */ }
            var before = comp.numLayers;
            app.executeCommand(cmdId);
            if (comp.numLayers <= before) {
                throw new Error("Convert Audio to Keyframes didn't create a layer. " +
                    "Make sure the composition viewer is active and try again.");
            }
            amplitudeLayer = comp.layer(1);

            // Effects are Left / Right / Both Channels; use "Both" by index so it
            // also works in localised versions of After Effects.
            var effects = amplitudeLayer.property("ADBE Effect Parade");
            var both = effects.property(effects.numProperties).property(1);
            for (i = 1; i <= both.numKeys; i++) {
                times.push(both.keyTime(i));
                amps.push(both.keyValue(i));
            }
        } finally {
            if (amplitudeLayer !== null) {
                amplitudeLayer.remove();
            }
            for (i = 0; i < muted.length; i++) {
                muted[i].audioEnabled = true;
            }
            layer.audioEnabled = targetWasEnabled;
        }

        if (times.length < 3) {
            throw new Error("No audio amplitude data was found on \"" + layer.name + "\".");
        }

        cache = {
            compId: comp.id,
            layerIndex: layer.index,
            layerName: layer.name,
            frameRate: comp.frameRate,
            workAreaStart: comp.workAreaStart,
            workAreaDuration: comp.workAreaDuration,
            times: times,
            amps: amps
        };
        return cache;
    }

    /**
     * Returns the times (seconds, comp time) of detected beats.
     *   sensitivity: 1..100   higher = more beats (lower threshold)
     *   spacingMs:   minimum gap between beats
     *   every:       keep every Nth detected beat
     */
    function detectBeats(times, amps, frameRate, sensitivity, spacingMs, every) {
        var n = amps.length;
        var i, j;

        // Threshold above local average: sensitivity 1 -> 1.80x, 100 -> 1.02x
        var s = Math.max(1, Math.min(100, sensitivity));
        var multiplier = 1.80 - (s - 1) / 99 * 0.78;

        var maxAmp = 0;
        for (i = 0; i < n; i++) {
            if (amps[i] > maxAmp) maxAmp = amps[i];
        }
        if (maxAmp <= 0) return [];
        // Ignore near-silence; the floor shrinks as sensitivity rises.
        var noiseFloor = maxAmp * (0.15 - (s - 1) / 99 * 0.12);

        // Local average over ~0.5s either side (prefix sums keep it O(n)).
        var half = Math.max(2, Math.round(frameRate * 0.5));
        var prefix = [0];
        for (i = 0; i < n; i++) prefix.push(prefix[i] + amps[i]);

        var minGap = spacingMs / 1000;
        var beats = [];
        var lastTime = -Infinity;
        var lastAmp = 0;

        for (i = 0; i < n; i++) {
            var a = amps[i];
            var prev = i > 0 ? amps[i - 1] : 0;
            var next = i < n - 1 ? amps[i + 1] : 0;
            if (a < noiseFloor || a <= prev || a < next) continue; // must be a local peak

            var lo = Math.max(0, i - half);
            var hi = Math.min(n - 1, i + half);
            var avg = (prefix[hi + 1] - prefix[lo]) / (hi - lo + 1);
            if (a < avg * multiplier) continue;

            if (times[i] - lastTime >= minGap) {
                beats.push(times[i]);
                lastTime = times[i];
                lastAmp = a;
            } else if (a > lastAmp) {
                // A stronger hit inside the spacing window replaces the weaker one.
                beats[beats.length - 1] = times[i];
                lastTime = times[i];
                lastAmp = a;
            }
        }

        if (every > 1) {
            var thinned = [];
            for (j = 0; j < beats.length; j += every) thinned.push(beats[j]);
            beats = thinned;
        }
        return beats;
    }

    // ------------------------------------------------------------------ markers

    function getMarkerProperty(comp, layer, onComp) {
        if (onComp) {
            if (!comp.markerProperty) {
                throw new Error("Composition markers need After Effects CC 2017 or newer.");
            }
            return comp.markerProperty;
        }
        return layer.property("ADBE Marker");
    }

    function clearBeatMarkers(markerProp) {
        var removed = 0;
        for (var i = markerProp.numKeys; i >= 1; i--) {
            var comment = markerProp.keyValue(i).comment;
            if (comment === MARKER_TAG || comment.indexOf(MARKER_TAG + " ") === 0) {
                markerProp.removeKey(i);
                removed++;
            }
        }
        return removed;
    }

    function placeMarkers(markerProp, beats, numbered, colorLabel) {
        for (var i = 0; i < beats.length; i++) {
            var mv = new MarkerValue(numbered ? MARKER_TAG + " " + (i + 1) : MARKER_TAG);
            try { mv.label = colorLabel; } catch (e) { /* label needs CC 2017+ */ }
            markerProp.setValueAtTime(beats[i], mv);
        }
    }

    // ------------------------------------------------------------------ helpers

    function getTarget() {
        var comp = app.project.activeItem;
        if (!(comp instanceof CompItem)) {
            throw new Error("Open a composition first.");
        }
        if (comp.selectedLayers.length !== 1) {
            throw new Error("Select exactly one layer with audio.");
        }
        var layer = comp.selectedLayers[0];
        if (!layer.hasAudio) {
            throw new Error("\"" + layer.name + "\" has no audio.");
        }
        return { comp: comp, layer: layer };
    }

    // ------------------------------------------------------------------ UI

    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", SCRIPT_NAME, undefined, { resizeable: true });
        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 8;
        win.margins = 10;

        // Intensity preset
        var presetGrp = win.add("panel", undefined, "Intensity");
        presetGrp.alignChildren = ["fill", "top"];
        var presetNames = [];
        for (var p = 0; p < PRESETS.length; p++) presetNames.push(PRESETS[p].name);
        var presetDD = presetGrp.add("dropdownlist", undefined, presetNames);

        // Sensitivity
        var sensRow = presetGrp.add("group");
        sensRow.add("statictext", undefined, "Sensitivity:").preferredSize.width = 85;
        var sensSlider = sensRow.add("slider", undefined, 50, 1, 100);
        sensSlider.preferredSize.width = 140;
        var sensText = sensRow.add("edittext", undefined, "50");
        sensText.characters = 4;
        sensSlider.helpTip = sensText.helpTip =
            "How loud a hit must be relative to its surroundings. Higher = more markers.";

        // Minimum spacing
        var gapRow = presetGrp.add("group");
        gapRow.add("statictext", undefined, "Min spacing:").preferredSize.width = 85;
        var gapSlider = gapRow.add("slider", undefined, 250, 30, 2000);
        gapSlider.preferredSize.width = 140;
        var gapText = gapRow.add("edittext", undefined, "250");
        gapText.characters = 4;
        gapRow.add("statictext", undefined, "ms");
        gapSlider.helpTip = gapText.helpTip =
            "Shortest allowed time between two markers. Higher = fewer markers.";

        // Every Nth beat
        var everyRow = presetGrp.add("group");
        everyRow.add("statictext", undefined, "Mark every:").preferredSize.width = 85;
        var everyLabels = [];
        for (var e = 0; e < EVERY_OPTIONS.length; e++) {
            everyLabels.push(EVERY_OPTIONS[e] === 1 ? "beat" : EVERY_OPTIONS[e] + " beats");
        }
        var everyDD = everyRow.add("dropdownlist", undefined, everyLabels);
        everyDD.selection = 0;
        everyDD.helpTip = "Thin out markers, e.g. keep only every 2nd or 4th beat.";

        // Output options
        var outGrp = win.add("panel", undefined, "Markers");
        outGrp.alignChildren = ["left", "top"];
        var targetRow = outGrp.add("group");
        targetRow.add("statictext", undefined, "Place on:");
        var onLayerRB = targetRow.add("radiobutton", undefined, "Audio layer");
        var onCompRB = targetRow.add("radiobutton", undefined, "Composition");
        onLayerRB.value = true;
        var colorRow = outGrp.add("group");
        colorRow.add("statictext", undefined, "Color label:");
        var colorDD = colorRow.add("dropdownlist", undefined,
            ["None", "Red", "Yellow", "Aqua", "Pink", "Lavender", "Peach", "Sea Foam",
             "Blue", "Green", "Purple", "Orange", "Brown", "Fuchsia", "Cyan", "Sandstone", "Dark Green"]);
        colorDD.selection = 1;
        var numberCB = outGrp.add("checkbox", undefined, "Number markers (Beat 1, Beat 2, ...)");
        var replaceCB = outGrp.add("checkbox", undefined, "Replace previous beat markers");
        replaceCB.value = true;

        // Buttons
        var btnRow = win.add("group");
        btnRow.alignChildren = ["fill", "center"];
        var markBtn = btnRow.add("button", undefined, "Mark Beats");
        var previewBtn = btnRow.add("button", undefined, "Count");
        var clearBtn = btnRow.add("button", undefined, "Clear");
        previewBtn.helpTip = "Analyse and report how many markers the current settings would create.";
        clearBtn.helpTip = "Remove beat markers created by this script.";

        var status = win.add("statictext", undefined, "Select an audio layer, then click Mark Beats.",
            { multiline: true });
        status.preferredSize.height = 34;

        // ---- control syncing

        var syncingPreset = false;

        function setCustom() {
            if (!syncingPreset) presetDD.selection = PRESETS.length - 1;
        }

        function clampInt(v, min, max, fallback) {
            var n = parseInt(v, 10);
            if (isNaN(n)) return fallback;
            return Math.max(min, Math.min(max, n));
        }

        sensSlider.onChanging = sensSlider.onChange = function () {
            sensText.text = String(Math.round(sensSlider.value));
            setCustom();
        };
        sensText.onChange = function () {
            var v = clampInt(sensText.text, 1, 100, Math.round(sensSlider.value));
            sensSlider.value = v;
            sensText.text = String(v);
            setCustom();
        };
        gapSlider.onChanging = gapSlider.onChange = function () {
            gapText.text = String(Math.round(gapSlider.value));
            setCustom();
        };
        gapText.onChange = function () {
            var v = clampInt(gapText.text, 30, 2000, Math.round(gapSlider.value));
            gapSlider.value = v;
            gapText.text = String(v);
            setCustom();
        };
        everyDD.onChange = setCustom;

        presetDD.onChange = function () {
            if (!presetDD.selection) return;
            var preset = PRESETS[presetDD.selection.index];
            if (preset.sensitivity === null) return; // Custom
            syncingPreset = true;
            sensSlider.value = preset.sensitivity;
            sensText.text = String(preset.sensitivity);
            gapSlider.value = preset.spacing;
            gapText.text = String(preset.spacing);
            for (var k = 0; k < EVERY_OPTIONS.length; k++) {
                if (EVERY_OPTIONS[k] === preset.every) everyDD.selection = k;
            }
            syncingPreset = false;
        };
        presetDD.selection = 1; // Medium

        function currentSettings() {
            return {
                sensitivity: Math.round(sensSlider.value),
                spacing: Math.round(gapSlider.value),
                every: EVERY_OPTIONS[everyDD.selection ? everyDD.selection.index : 0]
            };
        }

        function getBeats(target) {
            var data = isAnalysisValid(target.comp, target.layer)
                ? cache
                : analyseAudio(target.comp, target.layer);
            var s = currentSettings();
            return detectBeats(data.times, data.amps, data.frameRate, s.sensitivity, s.spacing, s.every);
        }

        function run(label, fn) {
            app.beginUndoGroup(SCRIPT_NAME + ": " + label);
            try {
                status.text = fn();
            } catch (err) {
                status.text = "Error: " + err.message;
                alert(err.message, SCRIPT_NAME);
            } finally {
                app.endUndoGroup();
            }
        }

        markBtn.onClick = function () {
            run("Mark Beats", function () {
                var target = getTarget();
                status.text = "Analysing audio...";
                var beats = getBeats(target);
                var markerProp = getMarkerProperty(target.comp, target.layer, onCompRB.value);
                var removed = replaceCB.value ? clearBeatMarkers(markerProp) : 0;
                placeMarkers(markerProp, beats, numberCB.value, colorDD.selection ? colorDD.selection.index : 0);
                var msg = "Placed " + beats.length + " beat marker" + (beats.length === 1 ? "" : "s");
                if (removed > 0) msg += " (replaced " + removed + ")";
                return msg + ".";
            });
        };

        previewBtn.onClick = function () {
            run("Analyse", function () {
                var beats = getBeats(getTarget());
                var bpm = "";
                if (beats.length > 1) {
                    var avgGap = (beats[beats.length - 1] - beats[0]) / (beats.length - 1);
                    bpm = ", avg ~" + Math.round(60 / avgGap) + " per minute";
                }
                return beats.length + " beats with current settings" + bpm + ".";
            });
        };

        clearBtn.onClick = function () {
            run("Clear Beat Markers", function () {
                var target = getTarget();
                var markerProp = getMarkerProperty(target.comp, target.layer, onCompRB.value);
                var removed = clearBeatMarkers(markerProp);
                return "Removed " + removed + " beat marker" + (removed === 1 ? "" : "s") + ".";
            });
        };

        win.onResizing = win.onResize = function () { this.layout.resize(); };
        if (win instanceof Window) {
            win.center();
            win.show();
        } else {
            win.layout.layout(true);
        }
        return win;
    }

    // Exposed for testing outside After Effects.
    if (typeof app === "undefined") {
        if (typeof module !== "undefined") module.exports = { detectBeats: detectBeats };
        return;
    }

    buildUI(thisObj);
})(this);
