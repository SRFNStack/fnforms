import { fnstate } from '../../lib/fntags.js'
import { div, flexRow, form, h3, i, input, label, option, section, select, span } from '../../lib/fnelements.js'
import { afterRouteChange, beforeRouteChange, listenFor } from '../../lib/fnroute.js'
import { isAuthenticated } from '../../fun/auth.js'
import { flexCenteredRow } from './fnelements.js'

/**
 * Create a formState that provides pre bound form elements
 * @param keyFn A function to extract the data's key from the data itself. The default uses the id property of the input, (foo) => foo.id
 * @param persistExpandState Whether to persist the expand state to local or session storage. Pass something truthy for local, and the string "session" for session
 * @return {*|HTMLDivElement|{expandedState: (function(*=): (*)), dropDown({title?: *, prop?: *, options: *}): HTMLDivElement, set(*=): void, bool({title?: *, prop?: *, initialValue?: *, style: *}): HTMLDivElement, clear: clear, float({title?: *, prop?: *, initialValue?: *, style: *}): HTMLDivElement, formGroup({title?: *, gridStyle?: *, expandable?: *, expandState?: *}, ...[*]): *, newForm: (function({isEdit?: *, onsubmit: *, key?: *, keyFn?: *, loadFn?: *, [p: string]: *}, ...[*]): HTMLFormElement), getState(): function(*=): (*), isDirty: (function(*=): (*)), isEdit: (function(*=): (*)), get(): *, text({title?: *, prop?: *, initialValue?: *, placeHolder?: *, style: *}): HTMLDivElement}|(function(*=): (*))}
 */
export function formstate( keyFn = foo => foo && foo.id, { persistExpandState } = {} ) {
    if( typeof keyFn !== 'function' ) {
        throw new Error( 'keyFn must be a function. It receives the current form data and should return the data\'s key' ).stack
    }
    const data = fnstate( {} )
    let expandedState = {}
    let clearAfterListener
    let clearBeforeListener
    const isEditState = fnstate( false )
    const isDirty = fnstate( false )
    let isEditDefault = false


    const loadExpandedState = () => {
        if( persistExpandState === 'session' ) {
            sessionStorage.getItem()
        }
    }

    const updateData = ( prop, transform ) => ( e ) => {
        isDirty( true )
        data.setPath( prop, transform( e ), true )
    }

    const initProp = ( prop, defaultValue ) => {
        if( !data.getPath( prop ) ) {
            data.setPath( prop, defaultValue, true )
        }
    }

    const confirmClearDirty = () => {
        //if the user is not authenticated, they probably got timed out and we don't want to erase their data
        if( isDirty() && isAuthenticated() ) {
            if( confirm( 'Form has unsaved changes.\nLeaving this page will erase those changes.\nWould you like to continue?' ) ) {
                clear()
            } else {
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

    const getExpandedState = key => {
        if( expandedState.hasOwnProperty( key ) ) {
            return expandedState[ key ]
        } else {
            return expandedState[ key ] = fnstate( false )
        }
    }

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

    const newInput = ( { prop, initialValue, type, style, oninput, attrs } ) => input(
        {
            ...( attrs() ),
            name: prop,
            type: type,
            style,
            oninput,
            disabled: isEditState.bindAttr( () => !isEditState() )
        }
    )

    return {
        commit(newData) {
            data(newData)
            isDirty(false)
        },
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
         * @param key The key to set the state to, this ensures that the data for this key is always loaded
         * @param loadFn A function to load the the data for the corresponding key
         * @param formAttrs All other properties are passed as attributes to the form element
         * @param children The children of the form element
         * @return {HTMLFormElement}
         */
        form: async function( {
                                  isEdit,
                                  onsubmit,
                                  key,
                                  loadFn,
                                  ...formAttrs
                              },
                              ...children
        ) {
            isEditDefault = !!isEdit
            clearListeners()

            if( typeof loadFn !== 'function' ) {
                throw new Error( 'loadFn must be a function. It receives the current key' ).stack
            }

            isEditState( !!isEdit )
            setTimeout( () => {
                clearBeforeListener = listenFor( beforeRouteChange, confirmClearDirty )
                clearAfterListener = listenFor( afterRouteChange, () => {
                    clearBeforeListener()
                    clearAfterListener()
                } )
            } )

            //fresh data, or key change
            if( !data() || ( key && keyFn( data() ) !== key ) ) {
                data( key ? await loadFn( key ) : {} )
                isDirty( false )
            }

            return form(
                {
                    ...formAttrs,
                    onsubmit: async e => {
                        e.preventDefault()
                        const res = await onsubmit( e )
                        if( res ) {
                            data( res )
                            isDirty( false )
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
        expandedState: getExpandedState,
        formGroup(
            {
                title,
                gridStyle,
                expandable = true,
                expandState
            }, ...children
        ) {
            if( typeof expandable !== 'boolean' ) {
                expandable = true
            }
            if( typeof expandState !== 'function' ) {
                expandState = fnstate( false )
            }
            if( !expandable ) {
                expandState( true )
            }
            return section(
                title ? h3( {
                                style: {
                                    'text-align': 'center',
                                    cursor: 'pointer'
                                },
                                onclick: () => expandable && expandState( !expandState() )
                            },
                            title,
                            expandable ? span( { style: { float: 'right' } },
                                               i( {
                                                      style: {
                                                          border: 'solid black',
                                                          'border-width': '0 3px 3px 0',
                                                          display: 'inline-block',
                                                          padding: '3px',
                                                          transform: expandState.bindStyle( () => expandState() ? 'rotate(45deg)' : 'rotate(-135deg)' )
                                                      }
                                                  }
                                               )
                                       )
                                       : ''
                ) : '',
                div(
                    {
                        style: Object.assign( gridStyle, {
                            display: expandState.bindStyle( () => expandState() ? 'grid' : 'none' ),
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
                style
            }
        ) {
            if( typeof initialValue !== 'string' ) {
                initialValue = ''
            }
            initProp( prop, initialValue )
            return formInput(
                title,
                newInput(
                    {
                        prop,
                        initialValue,
                        type: 'text',
                        oninput: updateData( prop, e => e.target.value ),
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
                style
            }
        ) {
            initProp( prop, initialValue )
            const doUpdate = updateData( prop, e => parseFloat( e.target.value ) )
            return formInput(
                title,
                newInput(
                    {
                        prop,
                        initialValue,
                        type: 'text',
                        oninput: ( e ) => {
                            const v = e.target.value
                            if( v.match( /^[+-]?([0-9]*[.])?[0-9]+$/ ) ) {
                                doUpdate( e )
                            } else {
                                if( v === '' ) {
                                    e.target.value = ''
                                    doUpdate( e )
                                } else {
                                    let numberOfDots = ( v.match( /\./g ) || [] ).length
                                    if( numberOfDots >= 1 ) {
                                        e.target.value = v.replace( /[.]+/, '.' )
                                        if( ( e.target.value.match( /\./g ) || [] ).length > 1 ) {
                                            e.target.value = v.slice( 0, -1 )
                                        } else if( e.target.value.match( /[^0-9.]$/ ) ) {
                                            e.target.value = v.slice( 0, -1 )
                                        }
                                    } else if( !v.match( /^[-+.]$/ ) ) {
                                        e.target.value = data.getPath( prop )
                                    }
                                }
                            }
                        },
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
                style
            }
        ) {
            if( typeof initialValue !== 'boolean' ) {
                initialValue = false
            }
            initProp( prop, initialValue )
            return formInput(
                title,
                newInput(
                    {
                        prop,
                        initialValue,
                        type: 'checkbox',
                        oninput: updateData( prop, e => e.target.checked ),
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
                options
            } ) {
            initProp( prop, options[ 0 ] )
            return formInput(
                title,

                select(
                    {
                        style: {
                            class: 'fnforms-drop-down-select',
                            'text-transform': 'capitalize'
                        },
                        disabled: isEditState.bindAttr( () => !isEditState() ),
                        oninput: updateData( prop, e => e.target.value )
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
            initialValue = initialValue ?? now
            if( !( initialValue instanceof Date ) ) {
                throw 'date initial value must be a date'
            }
            initProp( prop, initialValue )
            let dt = data.getPath( prop )
            if(!(dt instanceof Date)) {
                dt = new Date(dt)
                data.setPath(prop, dt)
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
                flexCenteredRow({style: { 'justify-content': 'space-around' }}, year, month, day )
            )
        }
    }

}
