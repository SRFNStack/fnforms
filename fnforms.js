import { fnstate } from '/lib/fntags.mjs'
import { div, flexCenteredRow, flexRow, form, h2, i, input, label, option, section, select, span } from './fnelements.mjs'
import { afterRouteChange, beforeRouteChange, listenFor } from './fnroute.mjs'

/**
 * Create a formState that provides pre bound form elements
 * @param initialData The initial state data
 */
export function formstate( initialData ) {
    const data = fnstate( initialData )
    let clearAfterListener
    let clearBeforeListener
    const isEditState = fnstate( false )
    const isDirty = fnstate( false )
    let isEditDefault = false

    class InputHandler {
        constructor( { prop, transform, validations } ) {
            this.transform = transform
            this.prop = prop
            this.validations = validations
            this.errors = fnstate( [] )
            this.isValid = fnstate( true )
            this.handleInput = this.handleInput.bind( this )
        }

        handleInput( e ) {
            isDirty( true )
            let value = e.target.value
            let errs = []
            if( this.validations ) {
                if( Array.isArray( this.validations ) ) {
                    errs = this.validations.reduce( ( valid, validation ) => valid && validation( value ), true )
                } else if( typeof this.validations === 'function' ) {
                    errs = this.validations( value )
                }
                if( errs && !Array.isArray( errs ) ) {
                    errs = [errs]
                }
            }
            this.errors( errs )
            if( errs.length === 0 ) {
                this.isValid( true )
                data.setPath( this.prop, this.transform ? this.transform( e ) : value, true )
            } else {
                this.isValid( false )
            }
        }
    }

    const initProp = ( prop, defaultValue ) => {
        if( !data.getPath( prop ) ) {
            data.setPath( prop, defaultValue, true )
        }
    }

    const confirmClearDirty = () => {
        if( isDirty() ) {
            if( !confirm( 'Form has unsaved changes.\nLeaving this page will erase those changes.\nWould you like to continue?' ) ) {
                throw 'cancelled'
            }
        }
    }

    function clear() {
        clearListeners()
        isDirty( false )
        isEditState( isEditDefault )
    }

    function clearListeners() {
        if( clearAfterListener ) {
            clearAfterListener()
            clearAfterListener = null
        }
        if( clearBeforeListener ) {
            clearBeforeListener()
            clearBeforeListener = null
        }
    }

    window.addEventListener( 'beforeunload', e => {
        if( isDirty() ) {
            e.preventDefault()
            e.returnValue = 'rusure'
        }
    } )

    function formInput( title, theInput ) {
        return flexRow(
            {
                style: {
                    'justify-content': 'space-between'
                }
            },
            title ? label( title ) : '',
            theInput
        )
    }

    const newInput = ( { prop, type, style, transform, attrs, validations, initialValue } ) => {
        initProp( prop, initialValue )
        let inputHandler = new InputHandler( { prop, transform, validations } )
        return input(
            {
                ...( attrs() ),
                name: prop,
                type: type,
                style,
                oninput: inputHandler.handleInput,
                disabled: isEditState.bindAttr( () => !isEditState() )
            }
        )
    }

    return {
        set( newData ) {
            data( newData )
            isDirty( true )
        },
        get() {
            return data()
        },
        getState() {
            return data
        },
        /**
         * Create a new form that is bound to this state
         * @param isEdit Whether the form should be in edit mode or not
         * @param onsubmit The onsubmit of the form, it should return the new data for the form state.
         * @param onsuccess A function that will be called with the saved data after it's submitted by onsubmit
         * @param formAttrs All other properties are passed as attributes to the form element
         * @param children The children of the form element
         * @return {HTMLFormElement}
         */
        form: async function( {
                                  isEdit,
                                  onsubmit,
                                  onsuccess,
                                  ...formAttrs
                              },
                              ...children
        ) {
            isEditDefault = !!isEdit
            clearListeners()

            isEditState( !!isEdit )

            clearBeforeListener = listenFor( beforeRouteChange, confirmClearDirty )
            clearAfterListener = listenFor( afterRouteChange, () => {
                clearBeforeListener()
                clearAfterListener()
            } )

            return form(
                {
                    ...formAttrs,
                    onsubmit: async e => {
                        e.preventDefault()
                        const res = await onsubmit( e )
                        if( res ) {
                            data( res )
                            isDirty( false )
                            if( typeof onsuccess === 'function' ) {
                                onsuccess( res )
                            }
                        }
                        return res
                    }
                },
                ...children
            )
        },
        isEdit: isEditState,
        isDirty,
        clear,
        formGroup(
            {
                title,
                gridStyle,
                expandable = true,
                isExpanded
            }, ...children
        ) {
            if( typeof expandable !== 'boolean' ) {
                expandable = !!expandable
            }
            if( typeof isExpanded !== 'function' ) {
                isExpanded = fnstate( !!isExpanded )
            }
            if( !expandable ) {
                isExpanded( true )
            }
            return section(
                title ? h2( {
                                style: {
                                    'text-align': 'center',
                                    cursor: 'pointer'
                                },
                                onclick: () => expandable && isExpanded( !isExpanded() )
                            },
                            title,
                            expandable ? span( { style: { float: 'right' } },
                                               i( {
                                                      style: {
                                                          border: 'solid black',
                                                          'border-width': '0 3px 3px 0',
                                                          display: 'inline-block',
                                                          padding: '3px',
                                                          transform: isExpanded.bindStyle( () => isExpanded() ? 'rotate(45deg)' : 'rotate(-135deg)' )
                                                      }
                                                  }
                                               )
                                       )
                                       : ''
                ) : '',
                div(
                    {
                        style: Object.assign( gridStyle, {
                            display: isExpanded.bindStyle( () => isExpanded() ? 'grid' : 'none' ),
                            'justify-content': 'center'
                        } )
                    },
                    ...children
                )
            )
        },
        text(
            {
                title,
                prop,
                initialValue = '',
                placeHolder = null,
                style,
                validations
            }
        ) {
            if( typeof initialValue !== 'string' ) {
                initialValue = ''
            }
            return formInput(
                title,
                newInput(
                    {
                        prop,
                        initialValue,
                        validations,
                        type: 'text',
                        style,
                        attrs: () => ( {
                            value: data.bindAttr( () => data.getPath( prop ) || initialValue ),
                            placeHolder
                        } )
                    }
                )
            )
        },
        float(
            {
                title,
                prop,
                initialValue = null,
                style,
                validations
            }
        ) {
            return formInput(
                title,
                newInput(
                    {
                        prop,
                        initialValue,
                        type: 'text',
                        transform: e => {
                            let v = e.target.value
                            //bad input is discarded instead of validations
                            if( v.match( /^[+-]?([0-9]*[.])?[0-9]+$/ ) ) {
                                //number is valid float format
                                return v
                            } else {
                                if( v === '' ) {
                                    return ''
                                } else {
                                    //attempt to sanitize input
                                    v = v.replaceAll( /[^-+0-9.]/g, '' )
                                    if( v.match( /^[+-]?([0-9]*[.])?[0-9]*$/ ) ) {
                                        //either only a +- sign or has a trailing .
                                        return v
                                    } else {
                                        //extra bad data
                                        e.target.value = data.getPath( prop )
                                        return data.getPath( prop )
                                    }
                                }
                            }
                        },
                        validations,
                        style,
                        attrs: () => ( {
                            value: data.bindAttr( () => data.getPath( prop ) || initialValue ),
                            placeHolder: '0'
                        } )
                    }
                )
            )
        },
        bool(
            {
                title,
                prop,
                initialValue = false,
                style,
                validations
            }
        ) {
            if( typeof initialValue !== 'boolean' ) {
                initialValue = false
            }
            return formInput(
                title,
                newInput(
                    {
                        prop,
                        initialValue,
                        validations,
                        type: 'checkbox',
                        style,
                        attrs: () => ( {
                            checked: data.bindAttr( () => !!( data.getPath( prop ) || initialValue ) )
                        } )
                    }
                )
            )
        },
        dropDown(
            {
                title,
                prop,
                options,
                validations
            } ) {
            initProp( prop, options[ 0 ] )
            let inputHandler = new InputHandler( { prop, validations } )
            return formInput(
                title,

                select(
                    {
                        style: {
                            class: 'fnforms-drop-down-select',
                            'text-transform': 'capitalize'
                        },
                        disabled: isEditState.bindAttr( () => !isEditState() ),
                        oninput: inputHandler.handleInput
                    },
                    options.map(
                        o => option(
                            {
                                value: o,
                                class: 'fnforms-drop-down-option',
                                selected: data.bindAttr( () => data.getPath( prop ) === o )
                            },
                            o.toLowerCase().replace( /[_]/, ' ' )
                        )
                    )
                )
            )
        },
        date(
            {
                title,
                prop,
                options,
                initialValue = new Date()
            }
        ) {
            options = options ?? {}
            const now = new Date()
            let dt = data.getPath( prop )
            if(dt){
                initialValue = dt
            } else if( !( dt instanceof Date ) ) {
                dt = new Date( dt )
                data.setPath( prop, dt )
                initialValue = dt
            } else {
                initialValue = initialValue ?? now
                if( !( initialValue instanceof Date ) ) {
                    throw 'date initial value must be a date'
                }
                initProp( prop, initialValue )
            }


            const selectedDate =
                fnstate( {
                             month: initialValue.getMonth() + 1,
                             day: initialValue.getDate(),
                             year: initialValue.getFullYear()
                         } )
            const getMaxDay = () => new Date( selectedDate().year, selectedDate().month, 0 ).getDate()
            const maxDay = fnstate( getMaxDay() )
            const minYear = options.minYear ?? now.getFullYear() - 150
            const maxYear = options.maxYear ?? now.getFullYear()

            function setSelectedDatePart( part, value, updateFn ) {
                let dt = data.getPath( prop )
                updateFn( dt, value )
                selectedDate.assign( { [ part ]: value } )
                isDirty( true )
                data.setPath( prop, dt )
                maxDay( getMaxDay() )
            }

            const intOptions = ( min, max, selectValue ) => Array( max - min + 1 ).fill( 0 ).map(
                ( v, i ) =>
                    option(
                        { value: i + min, selected: selectValue === i + min },
                        i + min
                    )
            )

            const datePartSelect = ( { part, updateFn, placeholder, min, max } ) =>
                flexCenteredRow(
                    div( { style: 'margin-right: 10px' }, placeholder ),
                    select(
                        {
                            oninput: e => setSelectedDatePart( part, parseInt( e.target.value ), updateFn )
                        },
                        ...intOptions( min, max, selectedDate()[ part ] )
                    ) )

            const day = maxDay.bindAs(
                () => datePartSelect(
                    {
                        part: 'day',
                        updateFn: ( dt, day ) => dt.setDate( day ),
                        placeholder: options.dayPlaceholder || 'Day:',
                        min: 1,
                        max: maxDay()
                    }
                )
            )

            const month = datePartSelect(
                {
                    part: 'month',
                    updateFn: ( dt, month ) => dt.setMonth( month - 1 ),
                    placeholder: options.monthPlaceholder || 'Month:',
                    min: 1,
                    max: 12
                }
            )

            const year = datePartSelect(
                {
                    part: 'year',
                    updateFn: ( dt, year ) => dt.setFullYear( year ),
                    placeholder: options.monthPlaceholder || 'Year:',
                    min: minYear,
                    max: maxYear
                }
            )

            return div(
                {
                    style: {
                        'justify-content': 'space-between'
                    }
                },
                title ? label( title ) : '',
                flexCenteredRow( { style: { 'justify-content': 'space-around' } }, year, month, day )
            )
        }
    }

}
