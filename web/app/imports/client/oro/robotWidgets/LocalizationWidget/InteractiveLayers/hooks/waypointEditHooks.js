/**
 * Auxiliary hooks for WaypointEdit layer.
 *
 * The useWaypointEditInteraction returns one single function to use as callback handler for
 * the "waypoint-edit" ActiveInteraction. It's a rather complex use (more than any other
 * interaction in Localization) since it handles different user actions (save, cancel, exit) and
 * persisting changes to DB (via Meteor calls).
 *
 * Notes:
 *  - This module should be the only one (apart from WaypointEdit) which reads or modifies
 *    the internal state of waypoint edit mode, stored in ActiveInteraction context data
 *  - The module is _mostly_ independent from "waypoints", and could turn into "map editing" hook
 *    in a future.
 *
 * Usage: Instantiate a ConfirmationSnackbar via hook (soon to be: via context), and pass this
 * hook a robot object and current frameId. Then use the returned
 * `executeWaypointInteractionCallback` function in ActiveInteractionControl for handling
 * interactions in Waypoint Edit mode. Example:
 * ```
 * const { openDialog, ConfirmationDialog } = useConfirmationSnackbar();
 * const { executeWaypointInteractionCallback } = useWaypointEditInteraction({
 *   robot,
 *   openDialog
 * });
 * ```
 *
 * TODO: display a "loading..." indicator while calling this method
 *
 * NOTE: METEOR DEPENDENT
 *
 * @see useConfirmationSnackbar
 * @see WaypointEdit
 *
 */
import { Meteor } from 'meteor/meteor';
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
// ORO modules
import { SnackbarVariants } from '../../../../util/CustomSnackbar';
import { useActiveInteraction } from '../../../../contexts/ActiveInteractionContext';
import { SPATIAL_ANNOTATION_TYPES } from '../../../../../../shared/constants';
import { useLocalizationWidget } from '../../../../contexts/LocalizationWidgetContext';

// TODO: Confirm whether EDIT_ACTIONS should be exported from ActiveInteractionControl in oro.
// Defined inline here until that export is added.
const EDIT_ACTIONS = {
  SAVE: 'save',
  REMOVE: 'remove',
  EXIT: 'exit'
};

const useWaypointEditInteraction = ({ robot, openDialog }) => {
  const { setInteractionData } = useActiveInteraction();
  const queryClient = useQueryClient();
  const { setSelectedAnnotationQualifiedId } = useLocalizationWidget();

  const executeWaypointInteractionCallback = useCallback((interactionData, userAction) => {
    if (userAction == EDIT_ACTIONS.EXIT) {
      // Simply exit the Edit mode. This 'true' is the signal for ActiveInteraction context
      // that the interaction was handled, so it exits the current interaction mode
      return true;
    }
    const { annotationQualifiedId, annotationData, addingNewElement } = interactionData;
    const { frameId: newWaypointDataFrameId, ...waypointData } = annotationData || {};
    let frameId;
    let annotationId;
    let confirmMessage;
    let confirmedVerb;

    if (addingNewElement) {
      // New waypoint. Action to discard it or to save it creating a new id
      if (userAction == EDIT_ACTIONS.REMOVE) {
        // Special case: It's a new waypoint, so the Trash icon simply discards it
        setInteractionData({ addingNewElement: false, modified: false });
        return false;
      }
      // TODO: Review entity mapping for oro context — determine robotId from robot object
      const robotId = robot?._id;
      if (!robotId) {
        console.error('Could not obtain robot id. Cannot save annotation', robot);
        return false;
      }
      frameId = newWaypointDataFrameId;
      confirmMessage = `Add waypoint "${annotationData.label}"?`;
      confirmedVerb = 'added';
    } else {
      // Updating a waypoint. Get its id from the callback data
      ({ frameId, annotationId } = annotationQualifiedId);
      const actionMsg = userAction == EDIT_ACTIONS.REMOVE ? 'Remove' : 'Update';
      confirmMessage = `${actionMsg} waypoint "${annotationData.label}"?`;
      confirmedVerb = userAction == EDIT_ACTIONS.REMOVE ? 'removed' : 'updated';
    }

    // TODO: Review entity mapping for oro context — determine the correct entityId/entityType
    // for annotation Meteor calls (robot-scoped vs. sublocation-scoped)
    const robotId = addingNewElement
      ? robot?._id
      : annotationQualifiedId?.robotId;

    if (!robotId || !frameId || (!annotationId && !addingNewElement)) {
      console.error('Incomplete annotation id in waypoint edit interaction callback',
        { robotId, frameId, annotationId, addingNewElement }
      );
      return false;
    }

    // Build a new annotation object. The type cannot change; the rest of the metadata is passed
    // as blackbox (x, y, theta, label)
    const annotation = {
      ...waypointData,
      type: SPATIAL_ANNOTATION_TYPES.WAYPOINT,
    };

    openDialog({
      message: confirmMessage,
      actionMessage: 'Yes',
      variant: SnackbarVariants.WARNING
    }, (ok) => {
      if (!ok) {
        return; // user declined confirmation: don't save any changes & stay in current mode
      }
      switch (userAction) {
        case EDIT_ACTIONS.REMOVE:
          Meteor.call('annotations.clearAnnotation', {
            robotId,
            frameId,
            annotationId
          }, (err) => {
            if (err) {
              openDialog({
                message: 'Error saving changes',
                variant: SnackbarVariants.ERROR
              });
              console.error('Error saving waypoint', err);
            } else {
              openDialog({
                message: 'Waypoint removed',
                variant: SnackbarVariants.SUCCESS
              });
              // Force reloading annotations, and unselect the edited waypoint
              queryClient.invalidateQueries('localization.annotations');
              setSelectedAnnotationQualifiedId(null);
              setInteractionData({ annotationQualifiedId: null, addingNewElement: false });
            }
          });
          break;
        case EDIT_ACTIONS.SAVE:
          Meteor.call('annotations.setAnnotation', {
            robotId,
            frameId,
            annotationId,
            annotation
          }, (err) => {
            if (err) {
              openDialog({
                message: 'Error saving changes',
                variant: SnackbarVariants.ERROR
              });
              console.error('Error saving waypoint', annotation, err);
            } else {
              openDialog({
                message: `Waypoint ${confirmedVerb}`,
                variant: SnackbarVariants.SUCCESS
              });
              // Force reloading annotations, and unselect the edited waypoint
              queryClient.invalidateQueries('localization.annotations');
              setSelectedAnnotationQualifiedId(null);
              setInteractionData({ annotationQualifiedId: null, addingNewElement: false });
            }
          });
          break;
        default:
          console.error('Unhandled userAction type in callback: ' + userAction);
      }
    });
    return false; // stay in this ActiveInteraction mode; the confirm message is still pending
  }, [robot]);

  return { executeWaypointInteractionCallback };
};

export default useWaypointEditInteraction;
export { EDIT_ACTIONS };
