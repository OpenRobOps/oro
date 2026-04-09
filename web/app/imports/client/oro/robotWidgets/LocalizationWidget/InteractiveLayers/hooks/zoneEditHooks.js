/**
 * Auxiliary hooks for ZoneEdit layer.
 *
 * The useZoneEditInteraction returns one single function to use as callback handler for
 * the "zone-edit" ActiveInteraction. It's a rather complex use (more than any other
 * interaction in Localization) since it handles different user actions (save, cancel, exit) and
 * persisting changes to DB (via Meteor calls). It's similar to what we do in waypointEditHooks.js
 *
 * Notes:
 *  - This module should be the only one (apart from ZoneEdit) which reads or modifies
 *    the internal state of zone edit mode, stored in ActiveInteraction context data
 *  - The module is _mostly_ independent from "zones".
 *  - It allows us to add, update or remove a zone OR a zone type
 *
 * Usage: Instantiate a ConfirmationSnackbar via hook (soon to be: via context), and pass this
 * hook a robot object and locationId. Then use the returned
 * `executeZoneInteractionCallback` function in ActiveInteractionControl for handling
 * interactions in zone Edit mode. Example:
 * ```
 * const { openDialog, ConfirmationDialog } = useConfirmationSnackbar();
 * const { executeZoneInteractionCallback } = useZoneEditInteraction({
 *   robot,
 *   locationId,
 *   openDialog
 * });
 * ```
 *
 * NOTE: METEOR DEPENDENT
 *
 * @see useConfirmationSnackbar
 * @see ZoneEdit
 *
 */
import { Meteor } from 'meteor/meteor';
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
// ORO modules
import { SnackbarVariants } from '../../../../util/CustomSnackbar';
import { useActiveInteraction } from '../../../../contexts/ActiveInteractionContext';
import { useLocalizationWidget } from '../../../../contexts/LocalizationWidgetContext';
import { EDIT_ACTIONS } from './waypointEditHooks';

// Callback to save edited/new zones or zone types
const useZoneEditInteraction = ({ robot, locationId, openDialog }) => {
  const { setInteractionData } = useActiveInteraction();
  const queryClient = useQueryClient();
  const { setSelectedAnnotationQualifiedId } = useLocalizationWidget();

  // TODO: Review entity mapping for oro context — confirm robotId usage for zone Meteor calls
  const robotId = robot?._id;

  const executeZoneInteractionCallback = useCallback((interactionData, userAction) => {
    if (userAction == EDIT_ACTIONS.EXIT) {
      // Simply exit the Edit mode. This 'true' is the signal for ActiveInteraction context
      // that the interaction was handled, so it exits the current interaction mode, clears
      // the active interaction context and deselect any selected zone
      setInteractionData({});
      setSelectedAnnotationQualifiedId(null);
      return true;
    }
    const { zoneData, addingNewElement } = interactionData;
    const { zoneId, zoneType, zone } = zoneData || {};
    const { _id: zoneTypeId, ...zoneTypeData } = zoneType || {};
    let confirmMessage;
    let confirmedVerb;
    if (addingNewElement) {
      // New zone. Action to discard it or to save it creating a new one
      if (userAction == EDIT_ACTIONS.REMOVE) {
        // Special case: It's a new zone, so the Trash icon simply discards it
        setInteractionData({});
        return false;
      }
      confirmMessage = `Add "${zoneType ? zoneType?.label : zone?.label}"?`;
      confirmedVerb = 'added';
    } else { // Updating a zone.
      const actionMsg = userAction == EDIT_ACTIONS.REMOVE ? 'Remove' : 'Update';
      confirmMessage = `${actionMsg} "${zoneType ? zoneType?.label : zone?.label}"?`;
      confirmedVerb = userAction == EDIT_ACTIONS.REMOVE ? 'removed' : 'updated';
    }
    if ((!zoneId && !addingNewElement && !zoneType?._id)) {
      console.error('Incomplete annotation id in zone edit interaction callback',
        { zoneId, zoneTypeId }
      );
      return false;
    }
    openDialog({
      message: confirmMessage,
      actionMessage: 'Yes',
      variant: SnackbarVariants.WARNING
    }, (ok) => {
      if (!ok) {
        return; // user declined confirmation: don't save any changes & stay in current mode
      }
      if (zoneType) {
        switch (userAction) {
          case EDIT_ACTIONS.REMOVE:
            Meteor.call('traffic_zones.removeZoneType', {
              robotId,
              zoneTypeId
            }, (err) => {
              if (err) {
                if (err.error === 'ZonesUsingType') {
                  openDialog({
                    message: 'There are Zones using this Zone Type, Delete them?',
                    actionMessage: 'Yes',
                    variant: SnackbarVariants.ERROR,
                    autoHideDuration: null
                  }, (confirmDelete) => {
                    if (confirmDelete) {
                      Meteor.call('traffic_zones.removeZoneType', {
                        robotId,
                        zoneTypeId,
                        forceDeletion: true
                      }, (deleteError) => {
                        if (deleteError) {
                          openDialog({
                            message: 'Error saving changes',
                            variant: SnackbarVariants.ERROR
                          });
                          console.error('Error deleting zone type', deleteError);
                        } else {
                          openDialog({
                            message: 'Zone Type removed',
                            variant: SnackbarVariants.SUCCESS
                          });
                          // Force reloading annotations, and unselect the edited zone type
                          setSelectedAnnotationQualifiedId(null);
                          setInteractionData({});
                        }
                      });
                    }
                  });
                } else {
                  openDialog({
                    message: 'Error saving changes',
                    variant: SnackbarVariants.ERROR
                  });
                  console.error('Error deleting zone type', err);
                }
              } else {
                openDialog({
                  message: 'Zone Type removed',
                  variant: SnackbarVariants.SUCCESS
                });
                // Force reloading annotations, and unselect the edited zone type
                setSelectedAnnotationQualifiedId(null);
                setInteractionData({});
              }
            });
            break;
          case EDIT_ACTIONS.SAVE:
            if (addingNewElement) {
              Meteor.call('traffic_zones.createZoneType', {
                robotId,
                zoneType
              }, (err) => {
                if (err) {
                  openDialog({
                    message: 'Error saving Zone Type',
                    variant: SnackbarVariants.ERROR
                  });
                  console.error('Error saving zone type', zone, err);
                } else {
                  openDialog({
                    message: `Zone Type ${confirmedVerb}`,
                    variant: SnackbarVariants.SUCCESS
                  });
                  // Force reloading annotations to change style if needed
                  queryClient.invalidateQueries('localization.annotations');
                  setSelectedAnnotationQualifiedId(null);
                  setInteractionData({});
                }
              });
            } else {
              Meteor.call('traffic_zones.updateZoneType', {
                robotId,
                zoneTypeId,
                zoneType: zoneTypeData
              }, (err) => {
                if (err) {
                  openDialog({
                    message: 'Error saving Zone Type',
                    variant: SnackbarVariants.ERROR
                  });
                  console.error('Error saving zone type', zone, err);
                } else {
                  openDialog({
                    message: `Zone Type ${confirmedVerb}`,
                    variant: SnackbarVariants.SUCCESS
                  });
                  // Force reloading annotations to change style if needed
                  queryClient.invalidateQueries('localization.annotations');
                  setSelectedAnnotationQualifiedId(null);
                  setInteractionData({});
                }
              });
            }
            break;
          default:
            console.error('Unhandled userAction type in callback: ' + userAction);
        }
      } else {
        switch (userAction) {
          case EDIT_ACTIONS.REMOVE:
            Meteor.call('traffic_zones.removeZone', {
              robotId,
              locationId,
              zoneId
            }, (err) => {
              if (err) {
                openDialog({
                  message: 'Error saving changes',
                  variant: SnackbarVariants.ERROR
                });
                console.error('Error saving zone', err);
              } else {
                openDialog({
                  message: 'Zone removed',
                  variant: SnackbarVariants.SUCCESS
                });
                // Force reloading annotations, and unselect the edited zone
                queryClient.invalidateQueries('localization.annotations');
                setSelectedAnnotationQualifiedId(null);
                setInteractionData({});
              }
            });
            break;
          case EDIT_ACTIONS.SAVE:
            if (addingNewElement) {
              Meteor.call('traffic_zones.createZone', {
                robotId,
                locationId,
                zone
              }, (err) => {
                if (err) {
                  openDialog({
                    message: 'Error saving changes',
                    variant: SnackbarVariants.ERROR
                  });
                  console.error('Error saving zone', zone, err);
                } else {
                  openDialog({
                    message: `Zone ${confirmedVerb}`,
                    variant: SnackbarVariants.SUCCESS
                  });
                  // Force reloading annotations, and unselect the edited zone
                  queryClient.invalidateQueries('localization.annotations');
                  setSelectedAnnotationQualifiedId(null);
                  setInteractionData({});
                }
              });
            } else {
              Meteor.call('traffic_zones.updateZone', {
                robotId,
                locationId,
                zoneId,
                zone
              }, (err) => {
                if (err) {
                  openDialog({
                    message: 'Error saving changes',
                    variant: SnackbarVariants.ERROR
                  });
                  console.error('Error saving zone', zone, err);
                } else {
                  openDialog({
                    message: `Zone ${confirmedVerb}`,
                    variant: SnackbarVariants.SUCCESS
                  });
                  // Force reloading annotations, and unselect the edited zone
                  queryClient.invalidateQueries('localization.annotations');
                  setSelectedAnnotationQualifiedId(null);
                  setInteractionData({});
                }
              });
            }
            break;
          default:
            console.error('Unhandled userAction type in callback: ' + userAction);
        }
      }
    });
    return false; // stay in this ActiveInteraction mode; the confirm message is still pending
  }, [robot]);

  return { executeZoneInteractionCallback };
};

export default useZoneEditInteraction;
