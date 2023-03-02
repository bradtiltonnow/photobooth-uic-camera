import { createCustomElement } from "@servicenow/ui-core";
import snabbdom from "@servicenow/ui-renderer-snabbdom";
import styles from "./styles.scss";
import { properties } from "./properties";
import { actionTypes } from "@servicenow/ui-core";
import { applyWatermark, initializeWatermark } from "./watermark";
import { selectMediaDevice, toggleTracks, getConnectedDevices, initializeCanvas, snap } from "./media";

import { PHOTOBOOTH_CAMERA_SNAPPED, PHOTOBOOTH_AVAILABLE_CAMERAS_UPDATED, PHOTOBOOTH_CAMERA_SINGLE_SNAPPED } from "./events";


const { COMPONENT_CONNECTED, COMPONENT_PROPERTY_CHANGED, COMPONENT_DOM_READY } =
	actionTypes;

const initialState = { snapState: "idle", watermarkImage: null };

const initializeMedia = ({
	host,
	updateState,
	dispatch,
	properties,
}) => {
	console.log("INITIALIZE MEDIA!");

	const {
		enabled,
		cameraDeviceId,
		shutterSoundFile
	} = properties;

	// Grab elements, create settings, etc.
	const video = host.shadowRoot.getElementById("video");
	const canvas = host.shadowRoot.ownerDocument.createElement("canvas");
	const context = canvas.getContext("2d");
	const shutterSound = new Audio(shutterSoundFile);

	initializeCanvas({context, ...properties});

	initializeWatermark(properties).then(updateState);

	selectMediaDevice({ video, cameraDeviceId, enabled });

	getConnectedDevices({cameraDeviceId}).then((cameras) => {
		console.log(PHOTOBOOTH_AVAILABLE_CAMERAS_UPDATED, cameras);
		dispatch(PHOTOBOOTH_AVAILABLE_CAMERAS_UPDATED, cameras);
	});

	updateState({
		video,
		context,
		shutterSound,
	});
};

const actionHandlers = {
	[COMPONENT_DOM_READY]: ({
		host,
		state: { properties },
		updateState,
		dispatch,
	}) => {
		console.log(COMPONENT_DOM_READY, host, properties);
		initializeMedia({ host, properties, dispatch, updateState });
	},

	[COMPONENT_CONNECTED]: ({properties}) => { console.log(COMPONENT_CONNECTED, properties)},

	[COMPONENT_PROPERTY_CHANGED]: ({
		state,
		action: {
			payload: { name, value, previousValue },
		},
		dispatch,
		updateState,
	}) => {
		console.log(COMPONENT_PROPERTY_CHANGED, { name, value });
		const {
			snapState,
			video,
			watermarkImage,
			properties: { enabled, watermarkImagePosition, gap },
		} = state;

		const propertyHandlers = {
			snapRequested: () => {
				if (value && value != previousValue) {
					const onIndividualSnap = ({imageData}) => { 
						console.log(PHOTOBOOTH_CAMERA_SINGLE_SNAPPED, {imageData})
						dispatch(PHOTOBOOTH_CAMERA_SINGLE_SNAPPED, {imageData})
					};
					snap({ state, updateState, onIndividualSnap }).then(({context}) => {
						console.log("SNAP COMPLETED", context);
						applyWatermark({context, watermarkImage, watermarkImagePosition, gap});
		
						const imageData = context.canvas.toDataURL("image/jpeg");
						dispatch(PHOTOBOOTH_CAMERA_SNAPPED, {imageData});
					});
				} else if (!value && snapState != "idle") {
					// Reset if the value for snapRequested is empty
					updateState({ snapState: "idle" });
				}
			},
			enabled: () => {
				toggleTracks({ video, enabled: value });
				updateState({ snapState: "idle" });
			},
			cameraDeviceId: () => {
				const cameraDeviceId = value;
				selectMediaDevice({
					video,
					cameraDeviceId,
					enabled
				});
				updateState({ cameraDeviceId });
			},
		};

		if (propertyHandlers[name]) {
			propertyHandlers[name]();
		}
	},
};

const view = ({
	snapState,
	properties: {
		countdownAnimationCss,
		pauseDurationSeconds,
		animationDuration = pauseDurationSeconds + "s",
	},
}) => {
	return (
		<div>
			<style>{countdownAnimationCss}</style>
			<div id="container" className={snapState}>
				<div
					id="flash"
					style={{
						"animation-iteration-count": 4,
						"animation-duration": animationDuration,
					}}
				></div>
				<video id="video" autoplay="" style={{ width: "100%" }}></video>
			</div>
		</div>
	);
};

const dispatches = {
	/**
	 * Dispatched when a camera picture is snapped.
	 * @type {{response:string}}
	 */
	PHOTOBOOTH_CAMERA_SNAPPED: {},

	/**
	 * Dispatched when the available cameras change
	 * @type {{response:object}}
	 */
	PHOTOBOOTH_AVAILABLE_CAMERAS_UPDATED: {},
};

createCustomElement("snc-photobooth-uic-camera", {
	renderer: { type: snabbdom },
	view,
	styles,
	initialState,
	actionHandlers,
	dispatches,
	properties,
});
