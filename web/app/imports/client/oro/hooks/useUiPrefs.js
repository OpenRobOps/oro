import { useTracker } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';
import { isArray } from 'lodash';
import { UIPreferences } from '../../../lib/collections';

const useUiPreferences = (widget) => useTracker(() => {
  const widgets = isArray(widget) ? widget : [widget];
  const handle = Meteor.subscribe('ui.preferences', { widget: widgets });
  return { data: UIPreferences.findOne() || {}, isLoading: !handle.ready() };
}, [widget]);

export default useUiPreferences;
