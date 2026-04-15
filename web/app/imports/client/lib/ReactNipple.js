/**
 * React wrapper for `nipplejs`
 *
 * This is a copy of the react-nipple source code, self-hosted inside our app to gain
 * control over the versions of dependencies, especially React 18.
 *
 * Original: https://github.com/loopmode/react-nipple
 *
 * Modifications:
 * - Changed @autobind decoration for arrow functions
 */
import nipplejs from 'nipplejs';
import isEqual from 'lodash.isequal';
import PropTypes from 'prop-types';
import React, { Component } from 'react';

import cx from 'classnames';

/**
 * A react wrapper component for `nipplejs`.
 * @see https://www.npmjs.com/package/nipplejs
 */
export default class ReactNipple extends Component {
    static get propTypes() {
        return {
            className: PropTypes.string,
            options: PropTypes.shape({
                color: PropTypes.string,
                size: PropTypes.number,
                threshold: PropTypes.number,
                fadeTime: PropTypes.number,
                multitouch: PropTypes.bool,
                maxNumberOfNipples: PropTypes.number,
                dataOnly: PropTypes.bool,
                position: PropTypes.object,
                mode: PropTypes.string,
                restJoystick: PropTypes.bool,
                restOpacity: PropTypes.number,
                catchDistance: PropTypes.number,
                lockX: PropTypes.bool,
                lockY: PropTypes.bool,
                shape: PropTypes.string,
                dynamicPage: PropTypes.bool
            }),
            static: PropTypes.bool,
            onStart: PropTypes.func,
            onEnd: PropTypes.func,
            onMove: PropTypes.func,
            onDir: PropTypes.func,
            onPlain: PropTypes.func,
            onShown: PropTypes.func,
            onHidden: PropTypes.func,
            onPressure: PropTypes.func,
            onCreated: PropTypes.func,
            onDestroy: PropTypes.func
        };
    }

    get ownProps() {
        return [
            'options',
            'static',
            'onStart',
            'onEnd',
            'onMove',
            'onDir',
            'onPlain',
            'onShown',
            'onHidden',
            'onPressure',
            'onCreated'
        ];
    }
    get elementProps() {
        return Object.entries(this.props).reduce((result, [key, value]) => {
            if (this.ownProps.includes(key)) {
                return result;
            }
            result[key] = value;
            return result;
        }, {});
    }

    componentDidUpdate(prevProps) {
        if (!isEqual(prevProps.options, this.props.options)) {
            this.destroyJoystick();
            this.createJoystick();
        }
    }

    render() {
        return (
            <div {...this.elementProps} ref={this.handleElement} className={cx('ReactNipple', this.props.className)} />
        );
    }

    handleElement = (ref) => {
        this._element = ref;
        if (ref) {
            this.createJoystick();
        } else {
            this.destroyJoystick();
        }
    }
    createJoystick() {
        const options = {
            zone: this._element,
            ...this.props.options
        };

        if (this.props.static) {
            options.mode = 'static';
            options.position = {
                top: '50%',
                left: '50%'
            };
        }

        const joystick = nipplejs.create(options);
        joystick.on('start', this.handleJoystickStart);
        joystick.on('end', this.handleJoystickEnd);
        joystick.on('move', this.handleJoystickMove);
        joystick.on('dir', this.handleJoystickDir);
        joystick.on('plain', this.handleJoystickPlain);
        joystick.on('shown', this.handleJoystickShown);
        joystick.on('hidden', this.handleJoystickHidden);
        joystick.on('pressure', this.handleJoystickPressure);

        this.joystick = joystick;

        if (this.props.onCreated) {
            this.props.onCreated(this.joystick);
        }
    }
    destroyJoystick() {
        if (this.joystick) {
            this.joystick.destroy();
            this.joystick = undefined;
        }
    }
    invokeCallback(type, evt, data) {
        if (this.props[type]) {
            this.props[type](evt, data);
        }
    }
    handleJoystickStart = (evt, data) => {
        this.invokeCallback('onStart', evt, data);
    }
    handleJoystickEnd = (evt, data) => {
        this.invokeCallback('onEnd', evt, data);
    }
    handleJoystickMove = (evt, data) => {
        this.invokeCallback('onMove', evt, data);
    }
    handleJoystickDir = (evt, data) => {
        this.invokeCallback('onDir', evt, data);
    }
    handleJoystickPlain = (evt, data) => {
        this.invokeCallback('onPlain', evt, data);
    }
    handleJoystickShown = (evt, data) => {
        this.invokeCallback('onShown', evt, data);
    }
    handleJoystickHidden = (evt, data) => {
        this.invokeCallback('onHidden', evt, data);
    }
    handleJoystickPressure = (evt, data) => {
        this.invokeCallback('onPressure', evt, data);
    }
}
