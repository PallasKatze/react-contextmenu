import React from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';
import assign from 'object-assign';

import AbstractMenu from './AbstractMenu';
import { callIfExists, cssClasses, hasOwnProp, store } from './helpers';
import listener from './globalEventListener';

export default class SubMenu extends AbstractMenu {
    static propTypes = {
        children: PropTypes.node.isRequired,
        attributes: PropTypes.object,
        title: PropTypes.node.isRequired,
        className: PropTypes.string,
        disabled: PropTypes.bool,
        hoverDelay: PropTypes.number,
        rtl: PropTypes.bool,
        selected: PropTypes.bool,
        onMouseMove: PropTypes.func,
        onMouseOut: PropTypes.func,
        forceOpen: PropTypes.bool,
        forceClose: PropTypes.func,
        parentKeyNavigationHandler: PropTypes.func,
        itemRef: PropTypes.oneOfType([PropTypes.func, PropTypes.object])
    };

    static defaultProps = {
        disabled: false,
        hoverDelay: 500,
        attributes: {},
        className: '',
        rtl: false,
        selected: false,
        onMouseMove: () => null,
        onMouseOut: () => null,
        forceOpen: false,
        forceClose: () => null,
        parentKeyNavigationHandler: () => null
    };

    constructor(props) {
        super(props);

        this.state = assign({}, this.state, {
            visible: false
        });
    }

    componentDidMount() {
        this.listenId = listener.register(() => {}, this.hideMenu);
    }

    getSubMenuType() { // eslint-disable-line class-methods-use-this
        return SubMenu;
    }

    shouldComponentUpdate(nextProps, nextState) {
        this.isVisibilityChange = (this.state.visible !== nextState.visible ||
                                  this.props.forceOpen !== nextProps.forceOpen) &&
                                  !(this.state.visible && nextProps.forceOpen) &&
                                  !(this.props.forceOpen && nextState.visible);
        return true;
    }

    componentDidUpdate() {
        if (!this.isVisibilityChange) return;
        if (this.props.forceOpen || this.state.visible) {
            const wrapper = window.requestAnimationFrame || setTimeout;
            wrapper(() => {
                const styles = this.getMenuPosition();

                this.subMenu.style.removeProperty('top');
                this.subMenu.style.removeProperty('bottom');
                this.subMenu.style.removeProperty('left');
                this.subMenu.style.removeProperty('right');

                if (hasOwnProp(styles, 'top')) this.subMenu.style.top = styles.top;
                if (hasOwnProp(styles, 'left')) this.subMenu.style.left = styles.left;
                if (hasOwnProp(styles, 'bottom')) this.subMenu.style.bottom = styles.bottom;
                if (hasOwnProp(styles, 'right')) this.subMenu.style.right = styles.right;
                this.subMenu.classList.add(cssClasses.menuVisible);

                this.registerHandlers();
                this.setState({ selectedItem: null });
            });
        } else {
            const cleanup = () => {
                this.subMenu.removeEventListener('transitionend', cleanup);
                this.subMenu.style.removeProperty('bottom');
                this.subMenu.style.removeProperty('right');
                this.subMenu.style.top = 0;
                this.subMenu.style.left = '100%';
                this.unregisterHandlers();
            };
            this.subMenu.addEventListener('transitionend', cleanup);
            this.subMenu.classList.remove(cssClasses.menuVisible);
        }
    }

    componentWillUnmount() {
        if (this.listenId) {
            listener.unregister(this.listenId);
        }

        if (this.opentimer) clearTimeout(this.opentimer);

        if (this.closetimer) clearTimeout(this.closetimer);

        this.unregisterHandlers();
    }


    getHorizontalPosition = (menuRect, areaRect) => {
        const { innerWidth } = window;

        if (areaRect.right > innerWidth) {
            // Clamp
            if (areaRect.left < 0) {
                return this.limitHorizontally(menuRect, areaRect);
            }

            // Left position
            return {
                right: '100%'
            };
        }

        // Right position
        return {
            left: '100%'
        };
    }

    limitHorizontally = (menuRect, areaRect) => {
        const { innerWidth } = window;

        // Clamp to left
        if ((innerWidth - menuRect.right) < menuRect.left) {
            return {
                right: `calc(100% - ${0 - areaRect.left}px`
            };
        }

        // Clamp to right
        return {
            left: `calc(100% - ${areaRect.right - innerWidth}px)`
        };
    }

    limitVertically = (menuRect, areaRect) => {
        const { innerHeight } = window;

        // Clamp to top
        if ((innerHeight - menuRect.bottom) < menuRect.top) {
            return {
                bottom: `${areaRect.top}px`
            };
        }

        // Clamp to bottom
        return {
            top: `${innerHeight - areaRect.bottom}px`
        };
    }

    getRTLHorizontalPosition = (menuRect, areaRect) => {
        const { innerWidth } = window;

        if (areaRect.left < 0) {
            // Clamp
            if (areaRect.right > innerWidth) {
                return this.limitHorizontally(menuRect, areaRect);
            }

            // Right position
            return {
                left: '100%'
            };
        }

        // Left position
        return {
            right: '100%'
        };
    }

    getMenuPosition = () => {
        const { innerHeight } = window;
        const { rtl } = this.props;

        const submenuRect = this.subMenu.getBoundingClientRect();
        const menuRect = this.menu.getBoundingClientRect();
        const padding = 10;

        const areaRect = {
            top: menuRect.bottom - submenuRect.height - padding,
            left: menuRect.left - submenuRect.width - padding,
            bottom: menuRect.top + submenuRect.height + padding,
            right: menuRect.right + submenuRect.width + padding
        };

        let position = {};

        // Vertical positioning
        if (areaRect.bottom > innerHeight) {
            if (areaRect.top < 0) {
                // Clamp
                position = Object.assign(position,
                    this.limitVertically(menuRect, areaRect)
                );
            } else {
                // Top position
                position.bottom = 0;
            }
        } else {
            // Bottom position
            position.top = 0;
        }

        // Horizontal positioning
        position = Object.assign(position,
            this[`get${rtl ? 'RTL' : ''}HorizontalPosition`](menuRect, areaRect)
        );

        return position;
    }

    hideMenu = () => {
        if (this.props.forceOpen) {
            this.props.forceClose();
        }
        this.setState({ visible: false, selectedItem: null });
        this.unregisterHandlers();
    };

    handleClick = (event) => {
        event.preventDefault();

        if (this.props.disabled) return;

        callIfExists(
            this.props.onClick,
            event,
            assign({}, this.props.data, store.data),
            store.target
        );
    }

    handleMouseEnter = () => {
        if (this.closetimer) clearTimeout(this.closetimer);

        if (this.props.disabled || this.state.visible) return;

        this.opentimer = setTimeout(() => this.setState({
            visible: true,
            selectedItem: null
        }), this.props.hoverDelay);
    }

    handleMouseLeave = () => {
        if (this.opentimer) clearTimeout(this.opentimer);

        if (!this.state.visible) return;

        this.closetimer = setTimeout(() => this.setState({
            visible: false,
            selectedItem: null
        }), this.props.hoverDelay);
    }

    menuRef = (c) => {
        this.menu = c;
    }

    subMenuRef = (c) => {
        this.subMenu = c;
    }

    registerHandlers = () => {
        document.removeEventListener('keydown', this.props.parentKeyNavigationHandler);
        document.addEventListener('keydown', this.handleKeyNavigation);
        document.addEventListener('dragstart', this.hideMenu);
    }

    unregisterHandlers = () => {
        document.removeEventListener('keydown', this.handleKeyNavigation);
        document.addEventListener('keydown', this.props.parentKeyNavigationHandler);
        document.removeEventListener('dragstart', this.hideMenu);
    }

    render() {
        const { children, attributes, disabled, title, selected } = this.props;
        const { visible } = this.state;
        const menuProps = {
            ref: this.menuRef,
            onMouseEnter: this.handleMouseEnter,
            onMouseLeave: this.handleMouseLeave,
            className: cx(cssClasses.menuItem, cssClasses.subMenu, attributes.listClassName, {
                [cx(cssClasses.menuItemDisabled, attributes.disabledClassName)]: disabled
            }),
            style: {
                position: 'relative'
            }
        };
        const menuItemProps = {
            className: cx(cssClasses.menuItem, attributes.className, {
                [cx(cssClasses.menuItemDisabled, attributes.disabledClassName)]: disabled,
                [cx(cssClasses.menuItemActive, attributes.visibleClassName)]: visible,
                [cx(cssClasses.menuItemSelected, attributes.selectedClassName)]: selected
            }),
            onMouseMove: this.props.onMouseMove,
            onMouseOut: this.props.onMouseOut,
            onClick: this.handleClick,
            ref: this.props.itemRef
        };
        const subMenuProps = {
            ref: this.subMenuRef,
            style: {
                position: 'absolute',
                transition: 'opacity 1ms', // trigger transitionend event
                top: 0,
                left: '100%'
            },
            className: cx(cssClasses.menu, this.props.className)
        };

        return (
            <nav {...menuProps} role='menuitem' tabIndex='-1' aria-haspopup='true'>
                <div {...attributes} {...menuItemProps}>
                    {title}
                </div>
                <nav {...subMenuProps} role='menu' tabIndex='-1'>
                    {this.renderChildren(children)}
                </nav>
            </nav>
        );
    }
}
