/**
 * Special class for creating tooltip formated messages
 * So far, we kept this new function in a separated file
 * to avoid code repetition in both designs (new and old)
 * TODO: Once deprecated the old style, move this function to ActionButtonsComponent.
 */
import React from 'react';

const createTooltipMessage = (action = null) => {
  const isDisabled = action.ui && action.ui.isDisabled;
  if (!action.description && !isDisabled) {
    // Return null to avoid an empty tooltip message
    return null;
  }

  return (
    <div>
      {action.description}
      {isDisabled && (
        <div data-test="action-disabled-tooltip">
          {`Cannot execute action: ${action.ui.disabledTooltip}`}
        </div>
      )}
    </div>
  );
};

export default createTooltipMessage;
